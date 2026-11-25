/**
 * Enforcement state resolution (#1180).
 *
 * The DB holds an append-only list of `enforcement_actions`; this module turns
 * that list into the answer to "what may this account do right now". Kept as
 * pure functions over rows — no DB, no env, no request — so the policy is
 * unit-testable and so the same resolution runs in a server fn, a workflow, and
 * the admin UI without three subtly different interpretations of "suspended".
 *
 * Effective state is always derived, never denormalized onto `user`/`teams`: a
 * cached flag drifts, and it drifts toward "we believed this account was
 * suspended and it was not".
 */

import { AccountRestrictedError } from '@/platform/errors';
import type {
  EnforcementActionType,
  ContentReportReason,
} from '@/platform/server/db/schema/compliance';

/**
 * The subset of an `enforcement_actions` row that decides effect. Structural
 * rather than the full model so tests and the workflow surface can build one
 * without a DB round-trip.
 */
export type EnforcementRow = {
  id: string;
  action: EnforcementActionType;
  reason: ContentReportReason;
  notes: string | null;
  effectiveAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

/**
 * Severity order, ascending. Used to pick the single action that explains a
 * block when several are live at once, so the notice a user sees names the
 * worst thing against them rather than whichever row sorted first.
 */
const SEVERITY: Record<EnforcementActionType, number> = {
  warning: 0,
  content_removed: 1,
  generation_suspended: 2,
  account_suspended: 3,
  account_terminated: 4,
};

const REASON_LABELS: Record<ContentReportReason, string> = {
  csam: '儿童性虐待材料',
  portrait_rights: '肖像权侵害',
  deepfake_impersonation: '深度伪造冒充',
  copyright: '版权或商标侵权',
  sexual_content: '未经同意或露骨的性内容',
  violence_or_harm: '暴力、有害或危险内容',
  hate_or_harassment: '仇恨言论或骚扰',
  illegal_or_regulated: '违法或受监管内容',
  misleading_content: '误导或欺骗性内容',
  other: '其他违规内容',
};

/**
 * Is this action in force at `now`?
 *
 * Revoked actions never count — that is what revocation means, and it is how a
 * granted appeal lifts a ban without erasing that it happened. A future
 * `effectiveAt` does not count either, so an action can be scheduled.
 */
export function isActionActive(row: EnforcementRow, now: Date): boolean {
  if (row.revokedAt) return false;
  if (row.effectiveAt.getTime() > now.getTime()) return false;
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export type EnforcementState = {
  /** Actions in force right now, most severe first. */
  active: EnforcementRow[];
  /** The most severe live action, or null when the account is clean. */
  mostSevere: EnforcementRow | null;
  /** May the account trigger new generations? */
  canGenerate: boolean;
  /** May the account create or modify content at all? */
  canWrite: boolean;
  /** May the account use the app beyond reading its own restriction notice? */
  canAccess: boolean;
};

/**
 * Capability ladder. Each action removes what its own rung and every rung below
 * it removes:
 *
 *  - `warning` / `content_removed` restrict nothing going forward. They are on
 *    the record and shown to the user, but an account that has had one video
 *    removed is not thereby barred from making the next one.
 *  - `generation_suspended` stops new generations while leaving the account
 *    able to sign in, read the notice, export legitimate work, and appeal. This
 *    is the proportionate response to most reports, and an enforcement regime
 *    whose only lever is a full ban gets reached for less often than it should.
 *  - `account_suspended` additionally makes the account read-only.
 *  - `account_terminated` removes access.
 */
function capabilitiesFor(action: EnforcementActionType | null): {
  canGenerate: boolean;
  canWrite: boolean;
  canAccess: boolean;
} {
  switch (action) {
    case 'account_terminated':
      return { canGenerate: false, canWrite: false, canAccess: false };
    case 'account_suspended':
      return { canGenerate: false, canWrite: false, canAccess: true };
    case 'generation_suspended':
      return { canGenerate: false, canWrite: true, canAccess: true };
    case 'warning':
    case 'content_removed':
    case null:
      return { canGenerate: true, canWrite: true, canAccess: true };
  }
}

/**
 * Resolve every action against a subject into one effective state.
 *
 * Pass every row for the user AND their team — a team-level action covers the
 * shared workspace, a user-level action follows the person — and let severity
 * decide. `now` is injected rather than read from the clock so expiry is
 * testable.
 */
export function resolveEnforcementState(
  rows: readonly EnforcementRow[],
  now: Date = new Date()
): EnforcementState {
  const active = rows
    .filter((row) => isActionActive(row, now))
    .sort((a, b) => SEVERITY[b.action] - SEVERITY[a.action]);

  const mostSevere = active[0] ?? null;
  return {
    active,
    mostSevere,
    ...capabilitiesFor(mostSevere?.action ?? null),
  };
}

/**
 * Human-readable explanation of a restriction, for the UI and for the error
 * body. Returns null when nothing is restricted.
 *
 * Names the action and the category, never the reporter or the report — a
 * subject learning who complained about them is how a rights complaint turns
 * into harassment of the complainant.
 */
export function restrictionNotice(state: EnforcementState): string | null {
  const worst = state.mostSevere;
  if (!worst) return null;

  const category = REASON_LABELS[worst.reason];
  switch (worst.action) {
    case 'account_terminated':
      return `此账号因涉及${category}违规已被关闭。`;
    case 'account_suspended':
      return `此账号因涉及${category}的举报已被暂停，目前仅可查看。`;
    case 'generation_suspended':
      return `此账号因涉及${category}的举报，已暂停新的生成任务。`;
    case 'content_removed':
      return `此账号中涉及${category}举报的内容已被移除。`;
    case 'warning':
      return `此账号已因${category}收到警告。`;
  }
}

/**
 * Throw if the account may not generate. Used by `requireGenerationAllowed`
 * and, via that, by `triggerWorkflow`.
 */
export function assertCanGenerate(state: EnforcementState): void {
  if (state.canGenerate) return;
  const worst = state.mostSevere;
  throw new AccountRestrictedError(
    restrictionNotice(state) ?? '此账号暂时无法生成内容。',
    {
      action: worst?.action,
      reason: worst?.reason,
      enforcementId: worst?.id,
      appealPath: '/report',
    }
  );
}

/** Throw if the account may not write. Mirrors {@link assertCanGenerate}. */
export function assertCanWrite(state: EnforcementState): void {
  if (state.canWrite) return;
  const worst = state.mostSevere;
  throw new AccountRestrictedError(
    restrictionNotice(state) ?? '此账号目前仅可查看。',
    {
      action: worst?.action,
      reason: worst?.reason,
      enforcementId: worst?.id,
      appealPath: '/report',
    }
  );
}
