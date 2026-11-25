/**
 * Storage Node — Local filesystem implementation for self-hosted deployments.
 *
 * Activated by updating the `default` branch of `#storage` in package.json.
 * Stores files on the local filesystem with the same API as storage-cloudflare.ts.
 *
 * Directory structure mirrors R2 key layout: <STORAGE_ROOT>/<bucket>/<path>
 */

import { createReadStream } from 'node:fs';
import {
  access,
  copyFile as fsCopyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import {
  buildR2Key,
  getPublicUrl,
  type MultipartPart,
  type StorageBucket,
  type StorageFileInfo,
  type UploadResult,
} from './buckets';

// Storage root directory — configurable via environment variable
const STORAGE_ROOT = process.env.STORAGE_ROOT || './storage';

function responseBody(stream: ReturnType<typeof createReadStream>): BodyInit {
  // Node's web-stream type and the DOM lib's equivalent are structurally
  // compatible at runtime but currently disagree on ArrayBuffer generics.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- bridges equivalent Node/DOM stream declarations
  return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
}

/**
 * Resolve the full filesystem path for a storage key.
 */
function resolveStoragePath(key: string): string {
  const root = resolve(STORAGE_ROOT);
  const resolved = resolve(root, key);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
    throw new Error('Storage key escapes the configured storage root');
  }
  return resolved;
}

/**
 * Ensure the parent directory exists for a given path.
 */
async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

/**
 * Convert various input types to a Buffer for writing.
 */
async function toBuffer(
  input: File | Blob | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>
): Promise<Buffer> {
  if (input instanceof Uint8Array) {
    return Buffer.from(input);
  }
  if (input instanceof ArrayBuffer) {
    return Buffer.from(input);
  }
  if (input instanceof Blob) {
    const arrayBuffer = await input.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  // ReadableStream
  const chunks: Uint8Array[] = [];
  const reader = input.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File | Blob | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
  options?: {
    upsert?: boolean;
    contentType?: string;
    cacheControl?: string;
  }
): Promise<UploadResult> {
  const key = buildR2Key(bucket, path);
  const filePath = resolveStoragePath(key);

  try {
    await ensureDir(filePath);
    const buffer = await toBuffer(file);
    await writeFile(filePath, buffer);

    // Store metadata in a sidecar .meta.json file
    if (options?.contentType) {
      const metaPath = `${filePath}.meta.json`;
      await writeFile(
        metaPath,
        JSON.stringify({
          contentType: options.contentType,
          cacheControl: options.cacheControl ?? 'public, max-age=31536000',
          uploadedAt: new Date().toISOString(),
        })
      );
    }

    const publicUrl = getPublicUrl(bucket, path);
    return {
      path: key,
      publicUrl,
      fullPath: key,
    };
  } catch (error) {
    throw new Error(
      `Failed to upload file to ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Multipart upload state stored in memory (for single-process deployments)
// For distributed deployments, this would need to be stored in Redis or similar
const multipartUploads = new Map<
  string,
  {
    key: string;
    contentType?: string;
    parts: Map<number, { path: string; size: number }>;
  }
>();

export async function createMultipartUpload(
  bucket: StorageBucket,
  path: string,
  contentType?: string
): Promise<{ uploadId: string; key: string }> {
  const key = buildR2Key(bucket, path);
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  multipartUploads.set(uploadId, {
    key,
    contentType,
    parts: new Map(),
  });

  return { uploadId, key };
}

export async function uploadPart(
  bucket: StorageBucket,
  path: string,
  uploadId: string,
  partNumber: number,
  body: ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView | Blob
): Promise<MultipartPart> {
  const upload = multipartUploads.get(uploadId);
  if (!upload) {
    throw new Error(`Multipart upload not found: ${uploadId}`);
  }

  const key = buildR2Key(bucket, path);
  const partPath = resolveStoragePath(`${key}.part${partNumber}`);

  await ensureDir(partPath);

  let buffer: Buffer;
  if (body instanceof ArrayBuffer) {
    buffer = Buffer.from(body);
  } else if (ArrayBuffer.isView(body)) {
    buffer = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  } else if (body instanceof Blob) {
    buffer = Buffer.from(await body.arrayBuffer());
  } else {
    // ReadableStream
    buffer = await toBuffer(body);
  }

  await writeFile(partPath, buffer);

  const etag = `"${partNumber}-${buffer.length}"`;
  upload.parts.set(partNumber, { path: partPath, size: buffer.length });

  return { partNumber, etag };
}

export async function completeMultipartUpload(
  bucket: StorageBucket,
  path: string,
  uploadId: string,
  parts: MultipartPart[]
): Promise<UploadResult> {
  const upload = multipartUploads.get(uploadId);
  if (!upload) {
    throw new Error(`Multipart upload not found: ${uploadId}`);
  }

  const key = buildR2Key(bucket, path);
  const finalPath = resolveStoragePath(key);

  await ensureDir(finalPath);

  // Sort parts by part number and concatenate
  const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  const chunks: Buffer[] = [];

  for (const part of sortedParts) {
    const partInfo = upload.parts.get(part.partNumber);
    if (!partInfo) {
      throw new Error(
        `Part ${part.partNumber} not found for upload ${uploadId}`
      );
    }
    const partBuffer = await readFile(partInfo.path);
    chunks.push(partBuffer);
    // Clean up part file
    await rm(partInfo.path, { force: true });
  }

  await writeFile(finalPath, Buffer.concat(chunks));

  // Store metadata
  if (upload.contentType) {
    const metaPath = `${finalPath}.meta.json`;
    await writeFile(
      metaPath,
      JSON.stringify({
        contentType: upload.contentType,
        cacheControl: 'public, max-age=31536000',
        uploadedAt: new Date().toISOString(),
      })
    );
  }

  multipartUploads.delete(uploadId);

  const publicUrl = getPublicUrl(bucket, path);
  return { path: key, publicUrl, fullPath: key };
}

export async function abortMultipartUpload(
  _bucket: StorageBucket,
  _path: string,
  uploadId: string
): Promise<void> {
  const upload = multipartUploads.get(uploadId);
  if (!upload) return;

  // Clean up all part files
  for (const [, partInfo] of upload.parts) {
    await rm(partInfo.path, { force: true });
  }

  multipartUploads.delete(uploadId);
}

export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  _expiresIn = 3600
): Promise<string> {
  // Local storage serves files publicly via the /r2 route — no signing needed
  return getPublicUrl(bucket, path);
}

export async function getSignedUrlWithDownload(
  bucket: StorageBucket,
  path: string,
  _filename: string,
  _expiresIn = 3600
): Promise<string> {
  // Local storage serves files publicly — download filename handled by route
  return getPublicUrl(bucket, path);
}

export async function getSignedUploadUrl(
  bucket: StorageBucket,
  path: string,
  contentType: string,
  _expiresIn = 600
): Promise<{
  uploadUrl: string;
  publicUrl: string;
  path: string;
  contentType: string;
}> {
  // Proxy uploads through the server — same pattern as R2
  const params = new URLSearchParams({ bucket, path, contentType });
  const uploadUrl = `/api/storage/upload?${params}`;
  const publicUrl = getPublicUrl(bucket, path);
  return { uploadUrl, publicUrl, path: buildR2Key(bucket, path), contentType };
}

export async function deleteFile(
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const key = buildR2Key(bucket, path);
  const filePath = resolveStoragePath(key);
  const metaPath = `${filePath}.meta.json`;

  try {
    await rm(filePath, { force: true });
    await rm(metaPath, { force: true });
  } catch (error) {
    throw new Error(
      `Failed to delete file from ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function deleteFiles(
  bucket: StorageBucket,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;

  try {
    await Promise.all(paths.map((path) => deleteFile(bucket, path)));
  } catch (error) {
    throw new Error(
      `Failed to delete files from ${bucket}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function listFiles(
  bucket: StorageBucket,
  path = '',
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: { column: string; order: 'asc' | 'desc' };
  }
): Promise<StorageFileInfo[]> {
  const prefix = buildR2Key(bucket, path);
  const dirPath = resolveStoragePath(prefix);

  try {
    await access(dirPath);
  } catch {
    return [];
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const files: StorageFileInfo[] = [];

    for (const entry of entries) {
      if (entry.isFile() && !entry.name.endsWith('.meta.json')) {
        const filePath = join(dirPath, entry.name);
        const stats = await stat(filePath);
        const metaPath = `${filePath}.meta.json`;

        let metadata: { contentType?: string; cacheControl?: string } = {};
        try {
          const metaContent = await readFile(metaPath, 'utf-8');
          metadata = JSON.parse(metaContent);
        } catch {
          // No metadata file — use defaults
        }

        files.push({
          name: entry.name,
          id: join(prefix, entry.name),
          updated_at: stats.mtime.toISOString(),
          created_at: stats.birthtime.toISOString(),
          last_accessed_at: stats.atime.toISOString(),
          metadata: {
            size: stats.size,
            mimetype: metadata.contentType ?? '',
            cacheControl: metadata.cacheControl ?? '',
            eTag: `"${stats.mtimeMs}"`,
          },
        });
      }
    }

    // Apply sorting
    if (options?.sortBy) {
      const { column, order } = options.sortBy;
      files.sort((a, b) => {
        const aVal = column === 'name' ? a.name : a.updated_at;
        const bVal = column === 'name' ? b.name : b.updated_at;
        const cmp = aVal.localeCompare(bVal);
        return order === 'desc' ? -cmp : cmp;
      });
    }

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? files.length;
    return files.slice(offset, offset + limit);
  } catch (error) {
    throw new Error(
      `Failed to list files in ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function moveFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string
): Promise<void> {
  const sourceKey = buildR2Key(bucket, fromPath);
  const destKey = buildR2Key(bucket, toPath);
  const sourcePath = resolveStoragePath(sourceKey);
  const destPath = resolveStoragePath(destKey);
  const sourceMetaPath = `${sourcePath}.meta.json`;
  const destMetaPath = `${destPath}.meta.json`;

  await ensureDir(destPath);
  await rename(sourcePath, destPath);

  try {
    await rename(sourceMetaPath, destMetaPath);
  } catch {
    // No metadata file to move
  }
}

export async function copyFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string
): Promise<void> {
  const sourceKey = buildR2Key(bucket, fromPath);
  const destKey = buildR2Key(bucket, toPath);
  const sourcePath = resolveStoragePath(sourceKey);
  const destPath = resolveStoragePath(destKey);
  const sourceMetaPath = `${sourcePath}.meta.json`;
  const destMetaPath = `${destPath}.meta.json`;

  try {
    await ensureDir(destPath);
    await fsCopyFile(sourcePath, destPath);

    try {
      await fsCopyFile(sourceMetaPath, destMetaPath);
    } catch {
      // No metadata file to copy
    }
  } catch (error) {
    throw new Error(
      `Failed to copy file from ${fromPath} to ${toPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function fileExists(
  bucket: StorageBucket,
  path: string
): Promise<boolean> {
  const key = buildR2Key(bucket, path);
  const filePath = resolveStoragePath(key);

  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a storage object's bytes by key (`<bucket>/<path>`).
 * Pass `range` to read a prefix without downloading the whole object.
 */
export async function readStorageObject(
  key: string,
  range?: { offset: number; length: number }
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string } | null> {
  const filePath = resolveStoragePath(key);
  const metaPath = `${filePath}.meta.json`;

  try {
    let buffer: Buffer;
    if (range) {
      const handle = await import('node:fs/promises').then((fs) =>
        fs.open(filePath, 'r')
      );
      try {
        buffer = Buffer.alloc(range.length);
        await handle.read(buffer, 0, range.length, range.offset);
      } finally {
        await handle.close();
      }
    } else {
      buffer = await readFile(filePath);
    }

    let contentType = '';
    try {
      const metaContent = await readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      contentType = meta.contentType ?? '';
    } catch {
      // No metadata file
    }

    const bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    return { bytes, contentType };
  } catch {
    return null;
  }
}

/**
 * Size in bytes of a storage object by key, or null when not found.
 */
export async function storageObjectSize(key: string): Promise<number | null> {
  const filePath = resolveStoragePath(key);

  try {
    const stats = await stat(filePath);
    return stats.size;
  } catch {
    return null;
  }
}

/**
 * Serve a storage object. Backs the `/r2/$` route for local serving.
 * Supports Range requests for video seeking.
 */
export async function serveFile(
  key: string,
  request: Request
): Promise<Response> {
  const filePath = resolveStoragePath(key);
  const metaPath = `${filePath}.meta.json`;

  let stats: Awaited<ReturnType<typeof stat>>;
  try {
    stats = await stat(filePath);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  // Read metadata
  let contentType = 'application/octet-stream';
  let cacheControl = 'public, max-age=31536000';
  try {
    const metaContent = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaContent);
    if (meta.contentType) contentType = meta.contentType;
    if (meta.cacheControl) cacheControl = meta.cacheControl;
  } catch {
    // Guess content type from extension
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      json: 'application/json',
    };
    if (ext && mimeTypes[ext]) {
      contentType = mimeTypes[ext];
    }
  }

  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', cacheControl);
  headers.set('accept-ranges', 'bytes');
  headers.set('etag', `"${stats.mtimeMs}"`);

  // Handle Range requests
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : stats.size - 1;
      const length = end - start + 1;

      headers.set('content-length', String(length));
      headers.set('content-range', `bytes ${start}-${end}/${stats.size}`);

      const stream = createReadStream(filePath, { start, end });
      return new Response(responseBody(stream), {
        status: 206,
        headers,
      });
    }
  }

  // Full file response
  headers.set('content-length', String(stats.size));
  const stream = createReadStream(filePath);
  return new Response(responseBody(stream), { headers });
}
