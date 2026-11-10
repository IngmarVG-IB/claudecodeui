#!/usr/bin/env node
// Load environment variables and check the Sandlot contract before any other
// module is evaluated: load-env.ts exits the process on a bad environment.
import './load-env.js';
import fs from 'fs';
import path from 'path';
import http from 'http';

import express, { type NextFunction, type Request, type Response } from 'express';

import { getSandlotConfig } from '@/sandlot/config.js';
import { createHeartbeatFileTracker } from '@/sandlot/heartbeat.js';
import { renderIndexHtml } from '@/sandlot/index-html.js';
import { AppError, findApplicationRoot, getModuleDirectory, terminalTextStyles } from '@/shared/utils.js';
import {
    closeSessionsWatcher,
    initializeSessionsWatcher,
    providerRuntimeService,
} from '@/modules/providers/index.js';
import { chatRunRegistry, createWebSocketServer } from '@/modules/websocket/index.js';

import { createGitModule } from './modules/git/index.js';
import {
    authenticateToken,
    authenticateWebSocket,
    authRoutes,
    ensureSandlotUser,
} from './modules/auth/index.js';
import { commandsRoutes } from './modules/commands/index.js';
import projectModuleRoutes from './modules/projects/projects.routes.js';
import { userRoutes } from './modules/user/index.js';
import providerRoutes from './modules/providers/provider.routes.js';
import {
    closeScheduledMessageDispatcher,
    initializeScheduledMessageDispatcher,
    scheduledMessagesRoutes,
} from './modules/scheduled-messages/index.js';
import { assetsRoutes } from './modules/assets/index.js';
import { fileTreeRoutes } from './modules/file-tree/index.js';
import { worktreesRoutes } from './modules/worktrees/index.js';
import { initializeDatabase, sessionsDb } from './modules/database/index.js';
import { restrictDatabaseFiles } from './modules/database/connection.js';

const config = getSandlotConfig();
const BASE_PATH = config.basePath;
const __dirname = getModuleDirectory(import.meta.url);
// The server source runs from /server, while the compiled output runs from /dist-server/server.
// Resolving the app root once keeps every repo-level lookup below aligned across both layouts.
const APP_ROOT = findApplicationRoot(__dirname);
const DIST_DIR = path.join(APP_ROOT, 'dist');
const RUNNING_VERSION = (() => {
    try {
        return JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')).version || null;
    } catch {
        return null;
    }
})();

const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);
const queryClaude = providerRuntimeService.getRunner('claude');
const gitRoutes = createGitModule({
    queryClaude,
});
const heartbeat = createHeartbeatFileTracker(config.heartbeatFile);

// A completed run stays subscribable while its session's background work
// (agents, workflows, backgrounded commands) is still reporting through it.
chatRunRegistry.setRetentionGuard((sessionId) => providerRuntimeService.hasBackgroundWork(sessionId));

// One WebSocket server for chat (<base>/ws) and shell (<base>/shell).
createWebSocketServer(server, {
    basePath: BASE_PATH,
    onAuthenticatedConnection: () => heartbeat.acquire(),
    verifyClient: {
        authenticateWebSocket,
    },
    chat: {
        runtime: providerRuntimeService,
    },
    shell: {
        resolveProviderSessionId: (sessionId) => {
            const dbSession = sessionsDb.getSessionById(sessionId);
            if (dbSession) {
                return dbSession.provider_session_id ?? null;
            }

            return null;
        },
    },
});

// Everything is served under CLOUDCLI_BASE_PATH. No CORS: the UI is
// same-origin behind code-server's proxy, and nothing else should call it.
const router = express.Router();

router.use(express.json({
    limit: '50mb',
    type: (req) => {
        // Skip multipart/form-data requests (for file uploads like images)
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('multipart/form-data')) {
            return false;
        }
        return contentType.includes('json');
    }
}));
router.use(express.urlencoded({ limit: '50mb', extended: true }));

// Public health check endpoint (no authentication required)
router.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: RUNNING_VERSION,
        mode: 'sandlot',
    });
});

// Authentication routes (public)
router.use('/api/auth', authRoutes);

router.use('/api/file-tree', authenticateToken, fileTreeRoutes);
router.use('/api/projects', authenticateToken, projectModuleRoutes);
// Chat attachment upload/serving (global ~/.cloudcli/assets store)
router.use('/api/assets', authenticateToken, assetsRoutes);
router.use('/api/git', authenticateToken, gitRoutes);
router.use('/api/worktrees', authenticateToken, worktreesRoutes);
router.use('/api/commands', authenticateToken, commandsRoutes);
router.use('/api/user', authenticateToken, userRoutes);
router.use('/api/providers', authenticateToken, providerRoutes);
router.use('/api/scheduled-messages', authenticateToken, scheduledMessagesRoutes);

// Unknown API paths are a JSON 404, never the SPA shell.
router.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
});

// index.html with CLOUDCLI_BASE_PATH written in, built once at startup.
const indexHtml = (() => {
    try {
        return renderIndexHtml(fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8'), BASE_PATH);
    } catch {
        return null;
    }
})();

const sendIndex = (_req: Request, res: Response) => {
    if (!indexHtml) {
        res.status(503).type('text/plain').send('The client bundle (dist/index.html) is missing: run npm run build.');
        return;
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.type('html').send(indexHtml);
};

router.get(['/', '/index.html'], sendIndex);

// Static files: the built client (dist, which includes everything from public/).
router.use(express.static(DIST_DIR, {
    index: false,
    setHeaders: (res, filePath) => {
        if (filePath.match(/[.-][A-Za-z0-9_-]{8}\.(js|css)$/) || filePath.includes(`${path.sep}assets${path.sep}`)) {
            // Hashed build assets can be cached for a year.
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Client-side routes (e.g. /session/<id>) get the SPA shell; files do not.
router.get('*', (req, res) => {
    if (path.extname(req.path)) {
        res.status(404).send('Not found');
        return;
    }
    sendIndex(req, res);
});

app.use(BASE_PATH || '/', router);

// Anything outside the base path.
app.use((_req, res) => {
    res.status(404).type('text/plain').send('Not found');
});

// global error middleware must be last
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  console.error(err);

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
});

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// Initialize database and start server
async function startServer() {
    try {
        await initializeDatabase();
        restrictDatabaseFiles();
        ensureSandlotUser();

        server.listen(config.port, config.host, async () => {
            const address = server.address();
            const bound = typeof address === 'object' && address ? `${address.address}:${address.port}` : `${config.host}:${config.port}`;
            console.log('');
            console.log(terminalTextStyles.dim('═'.repeat(63)));
            console.log(`  ${terminalTextStyles.bright('CloudCLI Server (Sandlot build) - Ready')}`);
            console.log(terminalTextStyles.dim('═'.repeat(63)));
            console.log('');
            console.log(`${terminalTextStyles.info('[INFO]')} Listening on ${bound}, base path "${BASE_PATH || '/'}"`);
            console.log(`${terminalTextStyles.info('[INFO]')} Claude Code: ${config.claudeCliPath}`);
            console.log(`${terminalTextStyles.info('[INFO]')} Database: ${process.env.DATABASE_PATH}`);
            if (config.heartbeatFile) {
                console.log(`${terminalTextStyles.info('[INFO]')} Heartbeat file: ${config.heartbeatFile}`);
            }
            console.log('');

            // Start watching the projects folder for changes
            await initializeSessionsWatcher();
            // Sends anything that came due while the server was not running,
            // then keeps polling.
            initializeScheduledMessageDispatcher(providerRuntimeService);
        });

        const shutdown = async () => {
            try {
                heartbeat.stop();
                await closeSessionsWatcher();
                closeScheduledMessageDispatcher();
            } catch (err) {
                console.error('[Shutdown] Error during shutdown:', getErrorMessage(err));
            }
            process.exit(0);
        };
        process.on('SIGTERM', () => void shutdown());
        process.on('SIGINT', () => void shutdown());
    } catch (error) {
        console.error('[ERROR] Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
