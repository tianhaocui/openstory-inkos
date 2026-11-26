/**
 * Shared helper: collects all deduplicated fal.ai endpoint IDs from our model configs.
 */
import {
  AUDIO_MODELS,
  EDIT_ENDPOINTS,
  IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
  MOTION_REFERENCE_ENDPOINTS,
} from './models';
import { studioVideoEndpointIds } from '@/studio/text-to-video';

export function getFalEndpointIds(): string[] {
  const video = Object.values(IMAGE_TO_VIDEO_MODELS).map((m) => m.id);
  const image = Object.values(IMAGE_MODELS).map((m) => m.id);
  const audio = Object.values(AUDIO_MODELS).map((m) => m.id);
  const edit = Object.values(EDIT_ENDPOINTS);
  // Both rows a reference-only shot can bill on (#1521): the reference
  // endpoint, and the text-to-video sibling it takes with no matched sheets.
  const motionRef = Object.values(MOTION_REFERENCE_ENDPOINTS).flatMap((m) => [
    m.endpointId,
    m.textToVideoEndpointId,
  ]);
  const studioVideo = studioVideoEndpointIds();

  // A DashScope id is a model name, not a fal queue endpoint — it is priced
  // by the static card, so it must not land in the local fal seed.
  const dashScopeIds = new Set<string>(
    Object.values(IMAGE_TO_VIDEO_MODELS)
      .filter((m) => 'dashscopeId' in m)
      .map((m) => m.id)
  );

  return [
    ...new Set([
      ...video,
      ...studioVideo,
      ...image,
      ...edit,
      ...audio,
      ...motionRef,
    ]),
  ].filter((id) => !dashScopeIds.has(id));
}

/**
 * Priceable fal endpoints that appear in NO listing — not fal's active
 * catalog, not modelschemas — so the pricing refresh must name them
 * explicitly. Verified against the pricing API when added. Endpoints we use
 * in model configs don't belong here (`getFalEndpointIds` covers those), and
 * neither do aliases: fal canonicalizes e.g.
 * `enterprise/image-to-video` → `enterprise/v2/image-to-video` and omits the
 * alias from any response that also names the canonical id.
 */
export const UNLISTED_FAL_ENDPOINTS = [
  'bytedance/seedance-2.0/enterprise/text-to-video',
  'bytedance/seedance-2.0/enterprise/v2/video-to-video',
];
