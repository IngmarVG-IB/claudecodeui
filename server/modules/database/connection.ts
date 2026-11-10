/**
 * Database connection management.
 *
 * Owns the single SQLite connection used across all repositories.
 * Handles path resolution, directory creation, legacy database migration,
 * and eager app_config bootstrap so the auth middleware can read the
 * JWT secret before the full schema is applied.
 *
 * Consumers should never create their own Database instance — they use
 * `getConnection()` to obtain the shared singleton.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import Database from 'better-sqlite3';

import { APP_CONFIG_TABLE_SCHEMA_SQL } from '@/modules/database/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the database file path from environment or falls back
 * to the legacy location inside the server/database/ folder.
 *
 * Priority:
 *   1. DATABASE_PATH environment variable (set by cli.js or load-env-vars.js)
 *   2. Legacy path: server/database/auth.db
 */
function resolveDatabasePath(): string {
    // Sandlot: load-env.ts sets DATABASE_PATH from the validated contract
    // (default ~/.local/share/cloudcli/auth.db).
    return process.env.DATABASE_PATH || resolveLegacyDatabasePath();
}

/**
 * Resolves the legacy database path (always inside server/database/).
 * Used for the one-time migration to the new external location.
 */
function resolveLegacyDatabasePath(): string {
  const serverDir = path.resolve(__dirname, '..', '..', '..');
  return path.join(serverDir, 'database', 'auth.db');
}

// ---------------------------------------------------------------------------
// Directory & migration helpers
// ---------------------------------------------------------------------------

/**
 * Sandlot: the database directory is private to the user (0700) and the
 * database file and its SQLite side files are 0600. The mode is set
 * explicitly rather than through the umask, which the Claude Code child
 * process would inherit for every file it writes.
 */
function ensureDatabaseDirectory(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    console.log('Created database directory:', dir);
  }
  fs.chmodSync(dir, 0o700);
}

function ensureDatabaseFile(dbPath: string): void {
  // Create it empty with 0600 before SQLite opens it, so it never exists
  // with wider permissions.
  fs.closeSync(fs.openSync(dbPath, 'a', 0o600));
  restrictDatabaseFiles(dbPath);
}

/** Sets 0600 on the database file and any -wal, -shm or -journal file beside it. */
export function restrictDatabaseFiles(dbPath: string = resolveDatabasePath()): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try {
      fs.chmodSync(dbPath + suffix, 0o600);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton connection
// ---------------------------------------------------------------------------

let instance: Database.Database | null = null;

/**
 * Returns the shared database connection, creating it on first call.
 *
 * The first invocation:
 *   1. Resolves the target database path
 *   2. Ensures the parent directory exists
 *   3. Creates the file with mode 0600 (directory 0700)
 *   4. Opens the SQLite connection
 *   5. Eagerly creates the app_config table (auth reads JWT secret at import time)
 *   6. Logs the database location
 */
export function getConnection(): Database.Database {
  if (instance) return instance;

  const dbPath = resolveDatabasePath();

  ensureDatabaseDirectory(dbPath);
  ensureDatabaseFile(dbPath);

  instance = new Database(dbPath);

  // app_config must exist immediately — the auth middleware reads
  // the JWT secret at module-load time, before initializeDatabase() runs.
  instance.exec(APP_CONFIG_TABLE_SCHEMA_SQL);

  return instance;
}

/**
 * Returns the resolved database file path without opening a connection.
 * Useful for diagnostics and CLI status commands.
 */
export function getDatabasePath(): string {
  return resolveDatabasePath();
}

/**
 * Closes the database connection and clears the singleton.
 * Primarily used for graceful shutdown or testing.
 */
export function closeConnection(): void {
  if (instance) {
    instance.close();
    instance = null;
    console.log('Database connection closed');
  }
}
