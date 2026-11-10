import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import test from 'node:test';

import {
  readWebSocketToken,
  selectWebSocketProtocol,
  WEBSOCKET_AUTH_PROTOCOL,
} from '@/modules/websocket/services/websocket-auth.service.js';

const JWT = 'aaa.bbb.ccc';
const request = (url: string, protocol?: string) => ({
  url,
  headers: protocol ? { 'sec-websocket-protocol': protocol } : {},
}) as unknown as IncomingMessage;

test('the token is read from Sec-WebSocket-Protocol first', () => {
  assert.equal(readWebSocketToken(request('/ws', `${WEBSOCKET_AUTH_PROTOCOL}, ${JWT}`)), JWT);
  assert.equal(readWebSocketToken(request('/ws?token=x.y.z', `${WEBSOCKET_AUTH_PROTOCOL}, ${JWT}`)), JWT);
});

test('the query string is the fallback on an upgrade', () => {
  assert.equal(readWebSocketToken(request(`/ws?token=${JWT}`)), JWT);
  assert.equal(readWebSocketToken(request('/ws')), null);
  assert.equal(readWebSocketToken(request('/ws?token=not-a-jwt')), null);
});

test('only the marker protocol is ever echoed back, never the token', () => {
  assert.equal(selectWebSocketProtocol(new Set([WEBSOCKET_AUTH_PROTOCOL, JWT])), WEBSOCKET_AUTH_PROTOCOL);
  assert.equal(selectWebSocketProtocol(new Set([JWT])), false);
});
