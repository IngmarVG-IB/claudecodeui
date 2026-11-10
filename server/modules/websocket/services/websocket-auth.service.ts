import type { IncomingMessage } from 'node:http';

import type { VerifyClientCallbackSync } from 'ws';

import type { AuthenticatedWebSocketRequest } from '@/shared/types.js';

/**
 * The subprotocol a client offers alongside its JWT:
 *   Sec-WebSocket-Protocol: cloudcli.bearer, <jwt>
 * The server selects `cloudcli.bearer`, so the token never sits in a URL
 * (and so never in a proxy's access log). `?token=<jwt>` is accepted on the
 * upgrade as a fallback for clients that cannot set subprotocols.
 */
export const WEBSOCKET_AUTH_PROTOCOL = 'cloudcli.bearer';

type WebSocketAuthDependencies = {
  authenticateWebSocket: (token: string | null) => {
    id?: string | number;
    userId?: string | number;
    username?: string;
    [key: string]: unknown;
  } | null;
};

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Reads the offered subprotocols in order. */
export function readOfferedProtocols(request: IncomingMessage): string[] {
  const header = request.headers['sec-websocket-protocol'];
  const raw = Array.isArray(header) ? header.join(',') : header ?? '';
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

/** The token from Sec-WebSocket-Protocol (preferred) or the query string. */
export function readWebSocketToken(request: IncomingMessage): string | null {
  const protocols = readOfferedProtocols(request);
  const markerIndex = protocols.indexOf(WEBSOCKET_AUTH_PROTOCOL);
  if (markerIndex !== -1) {
    const candidate = protocols[markerIndex + 1];
    return candidate && JWT_SHAPE.test(candidate) ? candidate : null;
  }

  const upgradeUrl = new URL(request.url ?? '/', 'http://localhost');
  const queryToken = upgradeUrl.searchParams.get('token');
  return queryToken && JWT_SHAPE.test(queryToken) ? queryToken : null;
}

/**
 * `handleProtocols` for the ws server: echo `cloudcli.bearer` when offered,
 * never the token itself.
 */
export function selectWebSocketProtocol(protocols: Set<string>): string | false {
  return protocols.has(WEBSOCKET_AUTH_PROTOCOL) ? WEBSOCKET_AUTH_PROTOCOL : false;
}

/**
 * Authenticates websocket upgrade requests before the `connection` handler runs.
 */
export function verifyWebSocketClient(
  info: Parameters<VerifyClientCallbackSync<AuthenticatedWebSocketRequest>>[0],
  dependencies: WebSocketAuthDependencies
): boolean {
  const request = info.req as AuthenticatedWebSocketRequest;
  const loggedUrl = new URL(request.url ?? '/', 'http://localhost');
  if (loggedUrl.searchParams.has('token')) {
    loggedUrl.searchParams.set('token', 'REDACTED');
  }

  const token = readWebSocketToken(request);
  const user = dependencies.authenticateWebSocket(token);
  if (!user) {
    console.log('[WARN] WebSocket authentication failed for', loggedUrl.pathname);
    return false;
  }

  request.user = user;
  return true;
}
