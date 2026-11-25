/**
 * Upload rights gate (#1581) — the one dialog every inline upload goes
 * through. An upload hook calls `ensureUploadRights(refs)` after the bytes
 * land and before finalize: each image is checked, and if any shows a real
 * person the sign-off dialog opens and the promise waits for Confirm. Cancel
 * rejects with {@link UploadRightsDeclinedError}, so the upload fails
 * instead of finalizing unsigned.
 *
 * Mounted once in the app shell next to <AuthGateProvider>; outside it
 * (Storybook, tests) wrap with <UploadRightsGateStub>.
 */

import { PortraitAttestationFields } from '@/cast/ui/talent-library/portrait-attestation-fields';
import { attestUploadsFn } from '@/cast/upload-rights.fn';
import type { UploadRef } from '@/cast/upload-rights';
import { PORTRAIT_RIGHTS_V2 } from '@/platform/compliance/attestations';
import { Button } from '@/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/shadcn/dialog';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { uploadRightsKeys, uploadRightsQuery } from './use-upload-rights';

class UploadRightsDeclinedError extends Error {
  constructor() {
    super('未确认拥有使用此人肖像的权利');
    this.name = 'UploadRightsDeclinedError';
  }
}

type UploadRightsGateValue = {
  /** Resolves once every image is cleared or signed; rejects if declined. */
  ensureUploadRights: (refs: UploadRef[]) => Promise<void>;
};

const UploadRightsGateContext = createContext<UploadRightsGateValue | null>(
  null
);

/** SSR fallback — uploads always pass during server render (no dialog to open). */
const SSR_FALLBACK: UploadRightsGateValue = {
  ensureUploadRights: () => Promise.resolve(),
};

export function useUploadRightsGate(): UploadRightsGateValue {
  const value = useContext(UploadRightsGateContext);
  // During SSR the provider isn't mounted yet; return a no-op so hooks that
  // depend on this (useUploadDraftElement) can still be called without throwing.
  // The actual dialog flow only runs client-side after hydration.
  if (!value) {
    if (typeof window === 'undefined') {
      return SSR_FALLBACK;
    }
    throw new Error(
      'useUploadRightsGate must be used within <UploadRightsGateProvider> (app shell) or <UploadRightsGateStub> (stories/tests)'
    );
  }
  return value;
}

/** Stand-in for trees outside the app shell: every upload passes. */
export function UploadRightsGateStub({ children }: { children: ReactNode }) {
  const value = useMemo<UploadRightsGateValue>(
    () => ({ ensureUploadRights: () => Promise.resolve() }),
    []
  );
  return (
    <UploadRightsGateContext.Provider value={value}>
      {children}
    </UploadRightsGateContext.Provider>
  );
}

type Pending = {
  refs: UploadRef[];
  resolve: () => void;
  reject: (error: Error) => void;
};

export function UploadRightsGateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending | null>(null);
  const [attested, setAttested] = useState(false);
  const [authorizationBasis, setAuthorizationBasis] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureUploadRights = useCallback(
    async (refs: UploadRef[]) => {
      const results = await Promise.all(
        refs.map((ref) => queryClient.fetchQuery(uploadRightsQuery(ref)))
      );
      const owed = refs.filter(
        (_, i) => results[i]?.status === 'needs_portrait'
      );
      if (owed.length === 0) return;
      await new Promise<void>((resolve, reject) => {
        setAttested(false);
        setAuthorizationBasis('');
        setError(null);
        setPending({ refs: owed, resolve, reject });
      });
    },
    [queryClient]
  );

  const close = (outcome: 'confirmed' | 'declined') => {
    if (!pending) return;
    if (outcome === 'confirmed') pending.resolve();
    else pending.reject(new UploadRightsDeclinedError());
    setPending(null);
  };

  const confirm = async () => {
    if (!pending || !attested || authorizationBasis.trim().length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await attestUploadsFn({
        data: {
          attestations: pending.refs.map((ref) => ({
            url: ref.url,
            statementVersion: PORTRAIT_RIGHTS_V2.version,
            authorizationBasis: authorizationBasis.trim(),
          })),
        },
      });
      await queryClient.invalidateQueries({ queryKey: uploadRightsKeys.all });
      close('confirmed');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法保存');
    } finally {
      setSaving(false);
    }
  };

  const value = useMemo<UploadRightsGateValue>(
    () => ({ ensureUploadRights }),
    [ensureUploadRights]
  );
  const canConfirm = attested && authorizationBasis.trim().length > 0;
  const names = pending?.refs.map((ref) => ref.filename ?? ref.url) ?? [];

  return (
    <UploadRightsGateContext.Provider value={value}>
      {children}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) close('declined');
        }}
      >
        <DialogContent
          className="max-w-lg"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            if (!(event.target instanceof HTMLInputElement)) return;
            event.preventDefault();
            if (canConfirm && !saving) void confirm();
          }}
        >
          <DialogHeader>
            <DialogTitle>检测到真人</DialogTitle>
            <DialogDescription>
              {names.length === 1
                ? `${names[0]} 中出现了真人。`
                : `${names.length} 个上传内容中出现了真人。`}{' '}
              请确认你拥有使用其肖像的权利，然后继续。
            </DialogDescription>
          </DialogHeader>
          <PortraitAttestationFields
            id="upload-rights-gate"
            attested={attested}
            onAttestedChange={setAttested}
            authorizationBasis={authorizationBasis}
            onAuthorizationBasisChange={setAuthorizationBasis}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close('declined')}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={!canConfirm || saving}
              onClick={() => void confirm()}
            >
              {saving ? '正在保存…' : '确认权利'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UploadRightsGateContext.Provider>
  );
}
