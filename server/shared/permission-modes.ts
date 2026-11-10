/**
 * Permission modes the Sandlot build accepts for a Claude turn.
 *
 * `bypassPermissions` (and its UI alias `skipPermissions`), `auto` (a model
 * classifier approves tool calls) and `dontAsk` are refused: every tool call
 * outside the user's allow-list must reach the user. The managed settings the
 * workspace image installs can disable bypass mode in the CLI as well; this
 * check makes the server refuse the request before a CLI is started.
 */
export const ALLOWED_PERMISSION_MODES = ['default', 'acceptEdits', 'plan'] as const;

export type AllowedPermissionMode = (typeof ALLOWED_PERMISSION_MODES)[number];

export const PERMISSION_MODE_REFUSED = 'PERMISSION_MODE_REFUSED';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

/**
 * Returns why a set of run options asks for a refused permission, or null
 * when they are acceptable. An absent `permissionMode` means `default`.
 */
export function findPermissionModeViolation(options: unknown): string | null {
  if (!isRecord(options)) {
    return null;
  }

  const mode = options.permissionMode;
  if (mode !== undefined && mode !== null && mode !== '') {
    if (typeof mode !== 'string' || !(ALLOWED_PERMISSION_MODES as readonly string[]).includes(mode)) {
      return `Permission mode "${String(mode)}" is not allowed; use one of: ${ALLOWED_PERMISSION_MODES.join(', ')}.`;
    }
  }

  if (options.skipPermissions === true || options.dangerouslySkipPermissions === true || options.allowDangerouslySkipPermissions === true) {
    return 'Skipping permission checks is not allowed.';
  }

  const toolsSettings = options.toolsSettings;
  if (isRecord(toolsSettings) && toolsSettings.skipPermissions === true) {
    return 'Skipping permission checks is not allowed.';
  }

  return null;
}

/** Throws when the options ask for a refused permission mode. */
export function assertAllowedPermissionMode(options: unknown): void {
  const violation = findPermissionModeViolation(options);
  if (violation) {
    const error = new Error(violation) as Error & { code?: string };
    error.code = PERMISSION_MODE_REFUSED;
    throw error;
  }
}
