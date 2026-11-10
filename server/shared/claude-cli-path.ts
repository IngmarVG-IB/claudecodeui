import { getSandlotConfig } from '@/sandlot/config.js';

/**
 * The Claude Code executable every Claude run uses: CLAUDE_CLI_PATH, checked
 * at startup to be an absolute path to an executable file
 * (server/sandlot/config.ts).
 *
 * Sandlot build: there is no search of PATH or node_modules and no
 * "let the SDK pick its bundled binary" fallback. The Agent SDK only looks
 * for its optional platform package when `pathToClaudeCodeExecutable` is
 * unset, and every call site passes this value, so the binary the workspace
 * image pins (with its managed settings) is the only one that ever runs.
 */
export function resolveClaudeCodeExecutablePath(): string {
  return getSandlotConfig().claudeCliPath;
}
