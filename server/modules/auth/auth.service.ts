import { AppError } from '@/shared/utils.js';

type AuthUser = {
  id: number | bigint;
  username: string;
};

type AuthDependencies = {
  getUser(): AuthUser | undefined;
  verifyPassword(password: string): boolean;
  updateLastLogin(userId: number): void;
  generateToken(user: AuthUser): string;
  /** Delay applied to every failed login, to slow guessing. */
  failureDelay(): Promise<void>;
};

/**
 * Sandlot auth service: one user, a password checked against
 * SANDLOT_PASSWORD_SHA256, no registration and no stored password.
 */
export function createAuthService(dependencies: AuthDependencies) {
  return {
    getStatus() {
      return {
        needsSetup: false,
        isAuthenticated: false,
        mode: 'sandlot',
      };
    },

    async login(passwordInput: unknown) {
      const password = typeof passwordInput === 'string' ? passwordInput : '';
      if (!password) {
        throw new AppError('Password is required', {
          code: 'AUTH_CREDENTIALS_REQUIRED',
          statusCode: 400,
        });
      }

      const user = dependencies.getUser();
      if (!user || !dependencies.verifyPassword(password)) {
        await dependencies.failureDelay();
        throw new AppError('Invalid password', {
          code: 'AUTH_INVALID_CREDENTIALS',
          statusCode: 401,
        });
      }

      dependencies.updateLastLogin(Number(user.id));
      return {
        success: true,
        user: { id: user.id, username: user.username },
        token: dependencies.generateToken(user),
      };
    },

    getCurrentUser(user: unknown) {
      return { user };
    },

    logout() {
      return { success: true, message: 'Logged out successfully' };
    },
  };
}
