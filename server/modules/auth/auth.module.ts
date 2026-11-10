import { userDb } from '@/modules/database/index.js';

import { authenticateToken, ensureSandlotUser, generateToken, verifySandlotPassword } from './auth.middleware.js';
import { createAuthRouter } from './auth.routes.js';
import { createAuthService } from './auth.service.js';

const LOGIN_FAILURE_DELAY_MS = 750;

const authService = createAuthService({
  getUser: () => ensureSandlotUser(),
  verifyPassword: (password) => verifySandlotPassword(password),
  updateLastLogin: (userId) => userDb.updateLastLogin(userId),
  generateToken,
  failureDelay: () => new Promise((resolve) => setTimeout(resolve, LOGIN_FAILURE_DELAY_MS)),
});

/** Auth router assembled for the server entrypoint. */
export const authRoutes = createAuthRouter(authService, authenticateToken);
