/**
 * Preloaded by `npm test` (tsx --import): gives the server test suite a
 * valid Sandlot contract so modules that read it (the Claude executable path,
 * the password hash) can be exercised. Only fills what the caller left unset;
 * the server itself never loads this file.
 */
import crypto from 'node:crypto';

process.env.SANDLOT_PASSWORD_SHA256 ??= crypto.createHash('sha256').update('sandlot-test-password').digest('hex');
process.env.CLAUDE_CLI_PATH ??= process.execPath;
