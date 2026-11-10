import express from 'express';
import type { RequestHandler } from 'express';

import type { createAuthService } from './auth.service.js';

type AuthenticatedRequest = express.Request & { user?: unknown };

/**
 * Auth routes, Sandlot mode:
 *   GET  /status  public, always { needsSetup: false, mode: 'sandlot' }
 *   POST /login   public, body { "password": "..." } -> { token, user }
 *   GET  /user    bearer token
 *   POST /logout  bearer token (client-side logout; tokens are not revocable)
 * There is no /register and no /refresh.
 */
export function createAuthRouter(
  service: ReturnType<typeof createAuthService>,
  authenticateToken: RequestHandler,
): express.Router {
  const router = express.Router();

  router.get('/status', (_req, res, next) => {
    try {
      res.json(service.getStatus());
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as { password?: unknown };
      res.setHeader('Cache-Control', 'no-store');
      res.json(await service.login(body.password));
    } catch (error) {
      next(error);
    }
  });

  router.get('/user', authenticateToken, (req, res) => {
    res.json(service.getCurrentUser((req as AuthenticatedRequest).user));
  });

  router.post('/logout', authenticateToken, (_req, res) => {
    res.json(service.logout());
  });

  return router;
}
