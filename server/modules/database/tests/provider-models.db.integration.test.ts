import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import Database from 'better-sqlite3';

import {
  closeConnection,
  getConnection,
  initializeDatabase,
  providerModelsDb,
  sessionsDb,
} from '@/modules/database/index.js';
import { runMigrations } from '@/modules/database/migrations.js';

test('migrations create the provider model index on an install that lacks it', async () => {
  const previousDatabasePath = process.env.DATABASE_PATH;
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'provider-model-index-'));
  const databasePath = path.join(tempDirectory, 'auth.db');

  closeConnection();
  process.env.DATABASE_PATH = databasePath;
  await writeFile(databasePath, '');
  await initializeDatabase();

  try {
    const db = getConnection();
    // Upgraded installs reach runMigrations with provider_models present but no
    // index, so the CREATE INDEX statement is compiled against the real table
    // instead of short-circuiting on the existing index name.
    db.exec('DROP INDEX IF EXISTS idx_provider_models_provider_order');

    runMigrations(db);

    const indexedColumns = (db
      .prepare('PRAGMA index_info(idx_provider_models_provider_order)')
      .all() as Array<{ name: string }>)
      .map((column) => column.name);
    assert.deepEqual(indexedColumns, ['provider', 'sort_order', 'id']);
  } finally {
    closeConnection();
    if (previousDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = previousDatabasePath;
    }
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test('provider model repository persists declared effort levels', async () => {
  const previousDatabasePath = process.env.DATABASE_PATH;
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'provider-model-effort-'));
  const databasePath = path.join(tempDirectory, 'auth.db');

  closeConnection();
  process.env.DATABASE_PATH = databasePath;
  await writeFile(databasePath, '');
  await initializeDatabase();

  try {
    const custom = providerModelsDb.createCustomProviderModel('claude', {
      model: 'My Custom Model',
      id: 'my-custom-model',
      effort: { values: ['low', 'high'], default: 'high' },
    });
    assert.deepEqual(custom.effort, { values: ['low', 'high'], default: 'high' });
    assert.deepEqual(
      providerModelsDb.listCustomProviderModels('claude')[0]?.effort,
      { values: ['low', 'high'], default: 'high' },
    );

    // Omitting effort on update keeps the stored levels.
    const renamed = providerModelsDb.updateCustomProviderModel('claude', custom.recordId, {
      model: 'Renamed',
      id: 'my-custom-model',
    });
    assert.deepEqual(renamed?.effort, { values: ['low', 'high'], default: 'high' });

    const narrowed = providerModelsDb.updateCustomProviderModel('claude', custom.recordId, {
      model: 'Renamed',
      id: 'my-custom-model',
      effort: { values: ['medium'] },
    });
    assert.deepEqual(narrowed?.effort, { values: ['medium'] });

    const cleared = providerModelsDb.updateCustomProviderModel('claude', custom.recordId, {
      model: 'Renamed',
      id: 'my-custom-model',
      effort: null,
    });
    assert.equal(cleared?.effort, null);
    const row = getConnection()
      .prepare('SELECT effort_values, effort_default FROM provider_models WHERE id = ?')
      .get(custom.recordId);
    assert.deepEqual(row, { effort_values: null, effort_default: null });
  } finally {
    closeConnection();
    if (previousDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = previousDatabasePath;
    }
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
