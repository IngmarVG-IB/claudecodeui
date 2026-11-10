import assert from 'node:assert/strict';
import test from 'node:test';

import { createProviderModelsService } from '@/modules/providers/services/provider-models.service.js';
import type {
  CustomProviderModelInput,
  CustomProviderModelRecord,
  LLMProvider,
  ProviderCurrentActiveModel,
  ProviderModelsDefinition,
} from '@/shared/types.js';
import { AppError } from '@/shared/utils.js';

const createModels = (value: string): ProviderModelsDefinition => ({
  OPTIONS: [{ value, label: value }],
  DEFAULT: value,
});

const createCurrentActiveModel = (model: string): ProviderCurrentActiveModel => ({ model });

/** In-memory stand-in for the `sessions` table rows the service reads and writes. */
const createSessionStore = (
  rows: Record<string, string | null> = {},
  efforts: Record<string, string | null> = {},
) => {
  const sessions = new Map(Object.entries(rows).map(([sessionId, model]) => [
    sessionId,
    { model, effort: efforts[sessionId] ?? null },
  ]));
  return {
    sessions,
    getSessionById: (sessionId: string) =>
      sessions.get(sessionId) ?? null,
    setSessionModel: (sessionId: string, model: string) => {
      const session = sessions.get(sessionId);
      if (session) {
        session.model = model;
      }
    },
    setSessionEffort: (sessionId: string, effort: string) => {
      const session = sessions.get(sessionId);
      if (session) {
        session.effort = effort;
      }
    },
  };
};

const createCatalogStore = () => {
  const rows = new Map<LLMProvider, CustomProviderModelRecord[]>();
  // Model ids the service asked the repository to move deleted models' sessions to.
  const deleteFallbacks: string[] = [];
  let nextRecordId = 1;
  const readRows = (provider: LLMProvider) => rows.get(provider) ?? [];

  return {
    rows,
    deleteFallbacks,
    listCustomProviderModels(provider: LLMProvider) {
      return [...readRows(provider)];
    },
    getCustomProviderModel(provider: LLMProvider, recordId: number) {
      return readRows(provider).find((record) => record.recordId === recordId) ?? null;
    },
    findCustomProviderModelByModelId(provider: LLMProvider, modelId: string) {
      return readRows(provider).find((record) => record.modelId === modelId) ?? null;
    },
    createCustomProviderModel(provider: LLMProvider, input: CustomProviderModelInput) {
      const record: CustomProviderModelRecord = {
        recordId: nextRecordId++,
        provider,
        modelId: input.id,
        model: input.model,
        sortOrder: readRows(provider).length,
        effort: input.effort ?? null,
      };
      rows.set(provider, [...readRows(provider), record]);
      return record;
    },
    updateCustomProviderModel(
      provider: LLMProvider,
      recordId: number,
      input: CustomProviderModelInput,
    ) {
      const existing = readRows(provider).find((record) => record.recordId === recordId);
      if (!existing) {
        return null;
      }
      const updated = {
        ...existing,
        modelId: input.id,
        model: input.model,
        // Mirrors the repository: an omitted effort keeps the stored levels.
        effort: input.effort === undefined ? existing.effort : input.effort,
      };
      rows.set(provider, readRows(provider).map((record) => (
        record.recordId === recordId ? updated : record
      )));
      return updated;
    },
    deleteCustomProviderModel(provider: LLMProvider, recordId: number, fallbackModelId: string) {
      const existing = readRows(provider).find((record) => record.recordId === recordId);
      if (!existing) {
        return null;
      }
      deleteFallbacks.push(fallbackModelId);
      rows.set(provider, readRows(provider).filter((record) => record.recordId !== recordId));
      return existing;
    },
  };
};

/** In-memory stand-in for the `app_config` key-value table. */
const createSettingsStore = () => {
  const values = new Map<string, string>();
  return {
    values,
    get: (key: string) => values.get(key) ?? null,
    set: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

const createTestService = (options: {
  catalog?: ReturnType<typeof createCatalogStore>;
  sessions?: ReturnType<typeof createSessionStore>;
  settings?: ReturnType<typeof createSettingsStore>;
  activeModel?: (provider: LLMProvider, sessionId?: string) => string;
  onCatalogRead?: (provider: LLMProvider) => void;
} = {}) => {
  const catalog = options.catalog ?? createCatalogStore();
  const sessions = options.sessions ?? createSessionStore();
  const settings = options.settings ?? createSettingsStore();
  const service = createProviderModelsService({
    catalog,
    sessions,
    settings,
    resolveProvider: (provider) => ({
      models: {
        getSupportedModels: async () => {
          options.onCatalogRead?.(provider);
          return createModels(`${provider}-default`);
        },
        getCurrentActiveModel: async (sessionId) => createCurrentActiveModel(
          options.activeModel?.(provider, sessionId) ?? `${provider}-default`,
        ),
      },
    }),
  });

  return { service, catalog, sessions, settings };
};

test('the custom-models-only flag is off by default and leaves the merged catalog unchanged', async () => {
  const { service } = createTestService();
  await service.createCustomModel('claude', { model: 'Gateway', id: 'gateway-model' });

  const models = await service.getProviderModels('claude');

  assert.deepEqual(models.OPTIONS.map((option) => option.value), ['claude-default', 'gateway-model']);
  assert.equal(models.DEFAULT, 'claude-default');
  assert.equal(models.CUSTOM_MODELS_ONLY, false);
});

test('custom-models-only makes the first custom model the session fallback', async () => {
  const { service } = createTestService({
    sessions: createSessionStore({ 'session-1': null, 'session-on-built-in': 'claude-default' }),
  });
  await service.createCustomModel('claude', { model: 'Gateway', id: 'gateway-model' });
  await service.setCustomModelsOnly('claude', true);

  // No session: the catalog default is the custom model.
  const withoutSession = await service.resolveSessionModel('claude');
  assert.equal(withoutSession.model, 'gateway-model');
  assert.equal(withoutSession.source, 'default');

  // An unrecorded session whose adapter only knows its built-in default must
  // not report that built-in as the session's own model.
  const unrecorded = await service.resolveSessionModel('claude', { sessionId: 'session-1' });
  assert.equal(unrecorded.model, 'gateway-model');
  assert.equal(unrecorded.source, 'default');

  // A session that already ran on a now-hidden built-in keeps its recorded
  // model; hiding built-ins never rewrites existing sessions.
  const recorded = await service.resolveSessionModel('claude', { sessionId: 'session-on-built-in' });
  assert.equal(recorded.model, 'claude-default');
  assert.equal(recorded.source, 'session');
  assert.equal(
    await service.resolveResumeModel('claude', 'session-on-built-in', 'gateway-model'),
    'claude-default',
  );
});

test('custom models can be created, edited, and deleted', async () => {
  const { service } = createTestService();
  const created = await service.createCustomModel('claude', {
    model: 'My Claude',
    id: 'claude-my-model',
  });
  const recordId = created.model.recordId as number;

  assert.equal(created.model.isCustom, true);
  assert.equal(created.models.OPTIONS.at(-1)?.value, 'claude-my-model');

  const updated = await service.updateCustomModel('claude', recordId, {
    model: 'My Better Claude',
    id: 'claude-my-model-v2',
  });
  assert.equal(updated.model.label, 'My Better Claude');
  assert.equal(updated.model.value, 'claude-my-model-v2');

  const removed = await service.deleteCustomModel('claude', recordId);
  assert.equal(removed.model.value, 'claude-my-model-v2');
  assert.equal(removed.models.OPTIONS.some((option) => option.recordId === recordId), false);
});

test('custom models carry declared effort levels into the merged catalog', async () => {
  const { service } = createTestService();

  const created = await service.createCustomModel('claude', {
    model: 'My Custom Model',
    id: 'my-custom-model',
    effort: { values: ['low', 'max'], default: 'max' },
  });
  const expectedEffort = { default: 'max', values: [{ value: 'low' }, { value: 'max' }] };
  assert.deepEqual(created.model.effort, expectedEffort);

  const catalog = await service.getProviderModels('claude');
  const merged = catalog.OPTIONS.find((option) => option.value === 'my-custom-model');
  assert.deepEqual(merged?.effort, expectedEffort);

  // A rename that does not mention effort (an older client) keeps the levels.
  const renamed = await service.updateCustomModel('claude', created.model.recordId as number, {
    model: 'Renamed',
    id: 'my-custom-model',
  });
  assert.deepEqual(renamed.model.effort, expectedEffort);

  const cleared = await service.updateCustomModel('claude', created.model.recordId as number, {
    model: 'Renamed',
    id: 'my-custom-model',
    effort: null,
  });
  assert.equal('effort' in cleared.model, false);
});

test('setSessionModel records the model on the session row', () => {
  const sessions = createSessionStore({ 'session-1': null });
  const { service } = createTestService({ sessions });

  const stored = service.setSessionModel('claude', 'session-1', 'opus');

  assert.deepEqual(stored, {
    provider: 'claude',
    sessionId: 'session-1',
    model: 'opus',
    effort: null,
    source: 'session',
  });
  assert.equal(sessions.sessions.get('session-1')?.model, 'opus');
});

test('setSessionModel ignores sessions that have no row yet', () => {
  const sessions = createSessionStore();
  const { service } = createTestService({ sessions });

  assert.equal(service.setSessionModel('claude', 'missing-session', 'opus'), null);
  assert.equal(sessions.sessions.size, 0);
});

test('resolveSessionModel prefers the recorded session model', async () => {
  const { service } = createTestService({
    sessions: createSessionStore({ 'session-1': 'haiku' }, { 'session-1': 'high' }),
    activeModel: () => 'provider-reported',
  });

  const resolved = await service.resolveSessionModel('claude', {
    sessionId: 'session-1',
    requestedModel: 'sonnet',
  });

  assert.equal(resolved.model, 'haiku');
  assert.equal(resolved.effort, 'high');
  assert.equal(resolved.source, 'session');
});

test('resolveSessionModel uses the requested model when provider reports the catalog default', async () => {
  const { service } = createTestService({
    sessions: createSessionStore({ 'session-1': null }),
  });

  const resolved = await service.resolveSessionModel('claude', {
    sessionId: 'session-1',
    requestedModel: 'haiku',
  });

  assert.equal(resolved.model, 'haiku');
  assert.equal(resolved.source, 'session');
});
