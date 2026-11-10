/**
 * The Sandlot environment contract, read and checked once at startup.
 *
 * Every value the hardened build depends on comes from here. `load-env.ts`
 * calls `initSandlotConfig()` before any other server module is evaluated, so
 * a missing or malformed value stops the process before it opens the
 * database, binds a port or spawns anything.
 *
 *   HOST                      bind address, default 127.0.0.1
 *   SERVER_PORT               TCP port, default 3001 (Sandlot sets 8091)
 *   CLOUDCLI_BASE_PATH        path prefix for static files, API and WebSockets,
 *                             e.g. /absproxy/8091; default '' (served at /)
 *   SANDLOT_PASSWORD_SHA256   required: sha256 of the login password, 64 lowercase hex
 *   CLAUDE_CLI_PATH           required: absolute path to the Claude Code executable
 *   CLOUDCLI_HEARTBEAT_FILE   optional: absolute path touched while a client is connected
 *   DATABASE_PATH             SQLite file, or a directory for auth.db in it;
 *                             default ~/.local/share/cloudcli/auth.db
 *   CLOUDCLI_RG_PATH          optional: absolute path to ripgrep (else `rg` on PATH)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type SandlotConfig = {
  host: string;
  port: number;
  /** '' or a prefix such as '/absproxy/8091' (leading slash, no trailing slash). */
  basePath: string;
  passwordSha256: string;
  claudeCliPath: string;
  heartbeatFile: string | null;
  databasePath: string;
  rgPath: string | null;
};

export class SandlotConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Refusing to start, the environment does not meet the Sandlot contract:\n  - ${problems.join('\n  - ')}`);
    this.name = 'SandlotConfigError';
    this.problems = problems;
  }
}

export type SandlotConfigDependencies = {
  homeDirectory?: string;
  statSync?: (target: string) => fs.Stats;
  accessSync?: (target: string, mode: number) => void;
  realpathSync?: (target: string) => string;
};

const PASSWORD_SHA256_PATTERN = /^[0-9a-f]{64}$/;
// Unreserved URL characters only, one or more segments: nothing a reverse
// proxy or the HTML rewrite in index.html could read two ways.
const BASE_PATH_PATTERN = /^(\/[A-Za-z0-9._~-]+)+$/;

function readTrimmed(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function expandHome(value: string, homeDirectory: string): string {
  if (value === '~') return homeDirectory;
  if (value.startsWith('~/')) return path.join(homeDirectory, value.slice(2));
  return value;
}

/**
 * Checks that `target` is an absolute path to a regular file this process may
 * execute. Returns the resolved real path, or pushes a problem and returns ''.
 */
function checkExecutable(
  name: string,
  target: string,
  problems: string[],
  deps: Required<SandlotConfigDependencies>,
): string {
  if (!path.isAbsolute(target)) {
    problems.push(`${name} must be an absolute path (got "${target}")`);
    return '';
  }
  let stats: fs.Stats;
  try {
    stats = deps.statSync(target);
  } catch {
    problems.push(`${name} does not exist: ${target}`);
    return '';
  }
  if (!stats.isFile()) {
    problems.push(`${name} is not a regular file: ${target}`);
    return '';
  }
  try {
    deps.accessSync(target, fs.constants.X_OK);
  } catch {
    problems.push(`${name} is not executable by this user: ${target}`);
    return '';
  }
  return deps.realpathSync(target);
}

/** Parses and validates the contract. Throws SandlotConfigError listing every problem found. */
export function parseSandlotConfig(
  env: NodeJS.ProcessEnv,
  dependencies: SandlotConfigDependencies = {},
): SandlotConfig {
  const deps: Required<SandlotConfigDependencies> = {
    homeDirectory: dependencies.homeDirectory ?? os.homedir(),
    statSync: dependencies.statSync ?? ((target) => fs.statSync(target)),
    accessSync: dependencies.accessSync ?? ((target, mode) => fs.accessSync(target, mode)),
    realpathSync: dependencies.realpathSync ?? ((target) => fs.realpathSync(target)),
  };
  const problems: string[] = [];

  const host = readTrimmed(env, 'HOST') || '127.0.0.1';

  const rawPort = readTrimmed(env, 'SERVER_PORT') || '3001';
  const port = /^\d+$/.test(rawPort) ? Number.parseInt(rawPort, 10) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`SERVER_PORT must be a TCP port number (got "${rawPort}")`);
  }

  let basePath = readTrimmed(env, 'CLOUDCLI_BASE_PATH').replace(/\/+$/, '');
  if (basePath && !BASE_PATH_PATTERN.test(basePath)) {
    problems.push(
      `CLOUDCLI_BASE_PATH must look like /absproxy/8091: path segments of letters, digits and . _ ~ - (got "${env.CLOUDCLI_BASE_PATH}")`,
    );
    basePath = '';
  }

  const passwordSha256 = readTrimmed(env, 'SANDLOT_PASSWORD_SHA256');
  if (!passwordSha256) {
    problems.push('SANDLOT_PASSWORD_SHA256 is not set (sha256 of the login password, 64 lowercase hex)');
  } else if (!PASSWORD_SHA256_PATTERN.test(passwordSha256)) {
    problems.push('SANDLOT_PASSWORD_SHA256 must be exactly 64 lowercase hex characters');
  }

  const rawCliPath = readTrimmed(env, 'CLAUDE_CLI_PATH');
  let claudeCliPath = '';
  if (!rawCliPath) {
    problems.push('CLAUDE_CLI_PATH is not set (absolute path to the Claude Code executable)');
  } else {
    claudeCliPath = checkExecutable('CLAUDE_CLI_PATH', rawCliPath, problems, deps);
  }

  const rawHeartbeat = readTrimmed(env, 'CLOUDCLI_HEARTBEAT_FILE');
  let heartbeatFile: string | null = null;
  if (rawHeartbeat) {
    const expanded = expandHome(rawHeartbeat, deps.homeDirectory);
    if (!path.isAbsolute(expanded)) {
      problems.push(`CLOUDCLI_HEARTBEAT_FILE must be an absolute path (got "${rawHeartbeat}")`);
    } else {
      heartbeatFile = expanded;
    }
  }

  const defaultDatabaseDirectory = path.join(deps.homeDirectory, '.local', 'share', 'cloudcli');
  const rawDatabasePath = readTrimmed(env, 'DATABASE_PATH');
  let databasePath = path.join(defaultDatabaseDirectory, 'auth.db');
  if (rawDatabasePath) {
    const expanded = expandHome(rawDatabasePath, deps.homeDirectory);
    if (!path.isAbsolute(expanded)) {
      problems.push(`DATABASE_PATH must be an absolute path (got "${rawDatabasePath}")`);
    } else {
      let isDirectory = expanded.endsWith('/');
      try {
        isDirectory = isDirectory || deps.statSync(expanded).isDirectory();
      } catch {
        // Not there yet: a file path, created on first start.
      }
      databasePath = isDirectory ? path.join(expanded, 'auth.db') : expanded;
    }
  }

  const rawRgPath = readTrimmed(env, 'CLOUDCLI_RG_PATH');
  let rgPath: string | null = null;
  if (rawRgPath) {
    rgPath = checkExecutable('CLOUDCLI_RG_PATH', rawRgPath, problems, deps) || null;
  }

  if (problems.length > 0) {
    throw new SandlotConfigError(problems);
  }

  return { host, port, basePath, passwordSha256, claudeCliPath, heartbeatFile, databasePath, rgPath };
}

let current: SandlotConfig | null = null;

/** Validates process.env once; later calls return the same object. */
export function initSandlotConfig(env: NodeJS.ProcessEnv = process.env): SandlotConfig {
  if (!current) {
    current = parseSandlotConfig(env);
  }
  return current;
}

/** The validated contract. Throws if `initSandlotConfig` has not succeeded. */
export function getSandlotConfig(): SandlotConfig {
  if (!current) {
    return initSandlotConfig();
  }
  return current;
}

/** Test hook: replaces (or clears) the cached contract. */
export function setSandlotConfigForTests(config: SandlotConfig | null): void {
  current = config;
}
