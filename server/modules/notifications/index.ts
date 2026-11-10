/**
 * Notifications in the Sandlot build: none leave the process.
 *
 * Upstream delivers run-lifecycle events by Web Push (web-push, VAPID keys),
 * to Electron desktop clients and to an outbound webhook. A Sandlot workspace
 * has no egress and no desktop app, so every channel is removed. The provider
 * runtimes still call these functions at the same points; they build the
 * event and drop it.
 */
type NotificationEventInput = {
  provider?: unknown;
  sessionId?: unknown;
  kind?: string;
  code?: string;
  meta?: Record<string, unknown>;
  severity?: string;
  dedupeKey?: string | null;
  requiresUserAction?: boolean;
};

/** Used by the Claude runtime to describe an event; kept so call sites stay unchanged. */
export function createNotificationEvent({
  provider,
  sessionId = null,
  kind = 'info',
  code = 'generic.info',
  meta = {},
  severity = 'info',
  dedupeKey = null,
  requiresUserAction = false,
}: NotificationEventInput) {
  return {
    provider,
    sessionId,
    kind,
    code,
    meta,
    severity,
    requiresUserAction,
    dedupeKey,
    createdAt: new Date().toISOString(),
  };
}

/** No delivery channel exists in this build. */
export function notifyUserIfEnabled(_input: unknown): void {}

/** No delivery channel exists in this build. */
export function notifyRunStopped(_input: unknown): void {}

/** No delivery channel exists in this build. */
export function notifyBackgroundWorkCompleted(_input: unknown): void {}

/** No delivery channel exists in this build. */
export function notifyRunFailed(_input: unknown): void {}
