import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseSandlotConfig, SandlotConfigError } from '@/sandlot/config.js';

const HASH = 'a'.repeat(64);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sandlot-config-'));
const executable = path.join(tmp, 'claude');
fs.writeFileSync(executable, '#!/bin/sh\n', { mode: 0o755 });
const notExecutable = path.join(tmp, 'plain');
fs.writeFileSync(notExecutable, 'x', { mode: 0o644 });

const base = { SANDLOT_PASSWORD_SHA256: HASH, CLAUDE_CLI_PATH: executable };

function problems(env: NodeJS.ProcessEnv): string[] {
  try {
    parseSandlotConfig(env, { homeDirectory: tmp });
    return [];
  } catch (error) {
    assert.ok(error instanceof SandlotConfigError);
    return error.problems;
  }
}

test('defaults: 127.0.0.1, port 3001, no base path, database under ~/.local/share/cloudcli', () => {
  const config = parseSandlotConfig(base, { homeDirectory: tmp });
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 3001);
  assert.equal(config.basePath, '');
  assert.equal(config.databasePath, path.join(tmp, '.local', 'share', 'cloudcli', 'auth.db'));
  assert.equal(config.heartbeatFile, null);
  assert.equal(config.rgPath, null);
  assert.equal(config.claudeCliPath, fs.realpathSync(executable));
});

test('the Sandlot values are read', () => {
  const config = parseSandlotConfig({
    ...base,
    HOST: '127.0.0.1',
    SERVER_PORT: '8091',
    CLOUDCLI_BASE_PATH: '/absproxy/8091/',
    CLOUDCLI_HEARTBEAT_FILE: '~/run/cloudcli.heartbeat',
    DATABASE_PATH: `${tmp}/`,
    CLOUDCLI_RG_PATH: executable,
  }, { homeDirectory: tmp });
  assert.equal(config.port, 8091);
  assert.equal(config.basePath, '/absproxy/8091');
  assert.equal(config.heartbeatFile, path.join(tmp, 'run', 'cloudcli.heartbeat'));
  assert.equal(config.databasePath, path.join(tmp, 'auth.db'));
  assert.equal(config.rgPath, fs.realpathSync(executable));
});

test('a missing or malformed SANDLOT_PASSWORD_SHA256 refuses to start', () => {
  assert.match(problems({ CLAUDE_CLI_PATH: executable }).join('\n'), /SANDLOT_PASSWORD_SHA256 is not set/);
  assert.match(problems({ ...base, SANDLOT_PASSWORD_SHA256: 'A'.repeat(64) }).join('\n'), /64 lowercase hex/);
  assert.match(problems({ ...base, SANDLOT_PASSWORD_SHA256: 'a'.repeat(63) }).join('\n'), /64 lowercase hex/);
  assert.match(problems({ ...base, SANDLOT_PASSWORD_SHA256: 'g'.repeat(64) }).join('\n'), /64 lowercase hex/);
});

test('CLAUDE_CLI_PATH must be an absolute path to an executable file', () => {
  assert.match(problems({ SANDLOT_PASSWORD_SHA256: HASH }).join('\n'), /CLAUDE_CLI_PATH is not set/);
  assert.match(problems({ ...base, CLAUDE_CLI_PATH: 'claude' }).join('\n'), /absolute path/);
  assert.match(problems({ ...base, CLAUDE_CLI_PATH: path.join(tmp, 'missing') }).join('\n'), /does not exist/);
  assert.match(problems({ ...base, CLAUDE_CLI_PATH: tmp }).join('\n'), /not a regular file/);
  assert.match(problems({ ...base, CLAUDE_CLI_PATH: notExecutable }).join('\n'), /not executable/);
});

test('a base path with unsafe characters or a bad port refuses to start', () => {
  assert.match(problems({ ...base, CLOUDCLI_BASE_PATH: 'absproxy/8091' }).join('\n'), /CLOUDCLI_BASE_PATH/);
  assert.match(problems({ ...base, CLOUDCLI_BASE_PATH: '/a b' }).join('\n'), /CLOUDCLI_BASE_PATH/);
  assert.match(problems({ ...base, CLOUDCLI_BASE_PATH: '/x"><script>' }).join('\n'), /CLOUDCLI_BASE_PATH/);
  assert.match(problems({ ...base, SERVER_PORT: '99999' }).join('\n'), /SERVER_PORT/);
});
