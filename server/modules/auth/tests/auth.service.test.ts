import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '@/shared/utils.js';

import { createAuthService } from '../auth.service.js';

type AuthDependencies = Parameters<typeof createAuthService>[0];

function createDependencies(overrides: Partial<AuthDependencies> = {}): AuthDependencies & { delays: number } {
  const state = { delays: 0 };
  const dependencies = {
    getUser: () => ({ id: 1, username: 'sandlot' }),
    verifyPassword: (password: string) => password === 'right',
    updateLastLogin: () => undefined,
    generateToken: () => 'signed-token',
    failureDelay: async () => {
      state.delays += 1;
    },
    ...overrides,
  };
  return Object.assign(dependencies, {
    get delays() {
      return state.delays;
    },
  });
}

test('status never asks for setup in Sandlot mode', () => {
  const service = createAuthService(createDependencies());
  assert.deepEqual(service.getStatus(), { needsSetup: false, isAuthenticated: false, mode: 'sandlot' });
});

test('login with the right password returns a token for the single user', async () => {
  let lastLogin: number | null = null;
  const service = createAuthService(createDependencies({ updateLastLogin: (id) => { lastLogin = id; } }));
  const result = await service.login('right');
  assert.equal(result.token, 'signed-token');
  assert.deepEqual(result.user, { id: 1, username: 'sandlot' });
  assert.equal(lastLogin, 1);
});

test('login with a wrong password is a 401 after the failure delay', async () => {
  const dependencies = createDependencies();
  const service = createAuthService(dependencies);
  await assert.rejects(service.login('wrong'), (error: unknown) => (
    error instanceof AppError && error.statusCode === 401 && error.code === 'AUTH_INVALID_CREDENTIALS'
  ));
  assert.equal(dependencies.delays, 1);
});

test('login without a password is a 400', async () => {
  const service = createAuthService(createDependencies());
  await assert.rejects(service.login(undefined), (error: unknown) => (
    error instanceof AppError && error.statusCode === 400
  ));
});

test('the service has no register and no refresh', () => {
  const service = createAuthService(createDependencies()) as Record<string, unknown>;
  assert.equal(service.register, undefined);
  assert.equal(service.refreshSession, undefined);
});
