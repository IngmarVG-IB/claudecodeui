// @ts-nocheck -- JWT request augmentation is narrowed by Auth route contracts.
/**
 * Sandlot authentication.
 *
 * - One user. The login password is never stored: the server holds only
 *   SANDLOT_PASSWORD_SHA256 from the environment and compares in constant time.
 * - The JWT signing secret is random per process and lives only in memory,
 *   so a restart signs everyone out.
 * - Tokens expire 12 hours after sign-in and are not refreshed.
 * - HTTP takes the token only from `Authorization: Bearer`. A WebSocket
 *   upgrade may carry it in Sec-WebSocket-Protocol or in `?token=`.
 * - There is no platform-mode bypass, no trusted-proxy header and no API key.
 */
import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { getSandlotConfig } from '@/sandlot/config.js';

import { userDb } from '../database/index.js';

const JWT_SECRET = crypto.randomBytes(32);
const JWT_ALGORITHM = 'HS256';
export const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60;
const SANDLOT_USERNAME = 'sandlot';
// The users table requires a password_hash; this value can never match a
// bcrypt hash or be produced by any password, and nothing compares against it.
const NO_STORED_PASSWORD = '!sandlot:no-stored-password';

/**
 * Returns the single user row, creating it on first start. Routes keep using
 * the row id for per-user preferences, drafts and git config.
 */
export const ensureSandlotUser = () => {
  const existing = userDb.getFirstUser();
  if (existing) {
    return existing;
  }
  userDb.createUser(SANDLOT_USERNAME, NO_STORED_PASSWORD);
  return userDb.getFirstUser();
};

/** Constant-time check of a candidate password against SANDLOT_PASSWORD_SHA256. */
export const verifySandlotPassword = (candidate) => {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return false;
  }
  const expected = Buffer.from(getSandlotConfig().passwordSha256, 'hex');
  const actual = crypto.createHash('sha256').update(candidate, 'utf8').digest();
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const readBearerToken = (req) => {
  const header = req.headers['authorization'];
  if (typeof header !== 'string') {
    return null;
  }
  const match = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\s*$/.exec(header);
  return match ? match[1] : null;
};

const verifyToken = (token) => {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  const user = userDb.getUserById(decoded.userId);
  return user ? { user, decoded } : null;
};

// JWT authentication middleware (HTTP)
const authenticateToken = async (req, res, next) => {
  // Sandlot: the Authorization header only. A token in the query string is
  // refused rather than ignored, so a stale `?token=` link fails loudly.
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'token')) {
    res.setHeader('X-Auth-Error', 'invalid-token');
    return res.status(401).json({
      error: 'Tokens are accepted only in the Authorization header.',
      code: 'AUTH_TOKEN_IN_URL_REFUSED',
    });
  }

  const token = readBearerToken(req);
  if (!token) {
    res.setHeader('X-Auth-Error', 'invalid-token');
    return res.status(401).json({
      error: 'Access denied. No token provided.',
      code: 'AUTH_TOKEN_INVALID',
    });
  }

  try {
    const verified = verifyToken(token);
    if (!verified) {
      res.setHeader('X-Auth-Error', 'invalid-token');
      return res.status(401).json({
        error: 'Invalid token. User not found.',
        code: 'AUTH_TOKEN_INVALID',
      });
    }
    req.user = verified.user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.setHeader('X-Auth-Error', 'session-expired');
      return res.status(401).json({
        error: 'Session expired. Please log in again.',
        code: 'AUTH_TOKEN_EXPIRED',
      });
    }
    res.setHeader('X-Auth-Error', 'invalid-token');
    return res.status(401).json({
      error: 'Invalid token',
      code: 'AUTH_TOKEN_INVALID',
    });
  }
};

// Generate JWT token (12 h, no refresh)
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
    },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: TOKEN_LIFETIME_SECONDS },
  );
};

// WebSocket authentication function
const authenticateWebSocket = (token) => {
  if (!token) {
    return null;
  }
  try {
    const verified = verifyToken(token);
    if (!verified) {
      return null;
    }
    return { userId: verified.user.id, username: verified.user.username };
  } catch {
    return null;
  }
};

export {
  authenticateToken,
  generateToken,
  authenticateWebSocket,
};
