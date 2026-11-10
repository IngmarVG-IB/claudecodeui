import type { Server as HttpServer } from 'node:http';

import { WebSocket, WebSocketServer, type VerifyClientCallbackSync } from 'ws';

import { handleChatConnection } from '@/modules/websocket/services/chat-websocket.service.js';
import { selectWebSocketProtocol, verifyWebSocketClient } from '@/modules/websocket/services/websocket-auth.service.js';
import { handleShellConnection } from '@/modules/websocket/services/shell-websocket.service.js';
import type { AuthenticatedWebSocketRequest } from '@/shared/types.js';

type WebSocketServerDependencies = {
  /** CLOUDCLI_BASE_PATH: '' or a prefix such as /absproxy/8091 that every socket path carries. */
  basePath: string;
  /** Called for every authenticated socket; the returned function runs on close (heartbeat file). */
  onAuthenticatedConnection?: () => () => void;
  verifyClient: Parameters<typeof verifyWebSocketClient>[1];
  chat: Parameters<typeof handleChatConnection>[2];
  shell: Parameters<typeof handleShellConnection>[1];
};

/**
 * Used by this module's websocket gateway to keep active transports alive and
 * close half-open connections so their route-specific clients can reconnect.
 */
export function attachWebSocketHeartbeat(
  ws: WebSocket,
  intervalMs = 30_000,
  scheduler = {
    setInterval,
    clearInterval,
  },
): () => void {
  let isAlive = true;
  let stopped = false;

  const markAlive = () => {
    isAlive = true;
  };

  const stopHeartbeat = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    scheduler.clearInterval(heartbeat);
    ws.off('pong', markAlive);
    ws.off('close', stopHeartbeat);
    ws.off('error', stopHeartbeat);
  };

  ws.on('pong', markAlive);
  ws.on('close', stopHeartbeat);
  ws.on('error', stopHeartbeat);

  const heartbeat = scheduler.setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // A socket that did not answer the previous ping is half-open from the
    // server's perspective. Terminating it emits close and lets clients resume.
    if (!isAlive) {
      stopHeartbeat();
      ws.terminate();
      return;
    }

    isAlive = false;
    try {
      ws.ping();
    } catch {
      stopHeartbeat();
      ws.terminate();
    }
  }, intervalMs);

  return stopHeartbeat;
}

/**
 * Creates and wires the server-wide websocket gateway used for the chat (/ws)
 * and shell (/shell) routes, both under CLOUDCLI_BASE_PATH. Exported through
 * the websocket module for server startup.
 */
export function createWebSocketServer(
  server: HttpServer,
  dependencies: WebSocketServerDependencies
): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    // Sandlot: the token may arrive as a subprotocol; only `cloudcli.bearer`
    // is ever echoed back, never the token.
    handleProtocols: (protocols) => selectWebSocketProtocol(protocols),
    verifyClient: ((
      info: Parameters<VerifyClientCallbackSync<AuthenticatedWebSocketRequest>>[0]
    ) => verifyWebSocketClient(info, dependencies.verifyClient)),
  });

  wss.on('connection', (ws, request) => {
    attachWebSocketHeartbeat(ws);

    const incomingRequest = request as AuthenticatedWebSocketRequest;
    const url = incomingRequest.url ?? '/';
    const fullPathname = new URL(url, 'http://localhost').pathname;
    const basePath = dependencies.basePath;
    // Every socket lives under the base path; anything else is closed.
    if (basePath && !(fullPathname === basePath || fullPathname.startsWith(`${basePath}/`))) {
      console.log('[WARN] WebSocket path outside CLOUDCLI_BASE_PATH:', fullPathname);
      ws.close();
      return;
    }
    const pathname = basePath ? fullPathname.slice(basePath.length) || '/' : fullPathname;

    if (pathname === '/shell' || pathname === '/ws') {
      const release = dependencies.onAuthenticatedConnection?.();
      if (release) {
        ws.once('close', release);
      }
    }

    if (pathname === '/shell') {
      handleShellConnection(ws, dependencies.shell);
      return;
    }

    if (pathname === '/ws') {
      handleChatConnection(ws, incomingRequest, dependencies.chat);
      return;
    }

    console.log('[WARN] Unknown WebSocket path:', pathname);
    ws.close();
  });

  return wss;
}
