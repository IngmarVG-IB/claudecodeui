import { WEBSOCKET_AUTH_PROTOCOL, webSocketUrl } from '@/shared/basePath';
import { getStoredAuthToken } from '@/shared/authToken';

type ShellInitMessage = {
  type: 'init';
  projectPath: string;
  sessionId: string | null;
  hasSession: boolean;
  provider: string;
  cols: number;
  rows: number;
  initialCommand: string | null | undefined;
  isPlainShell: boolean;
  forceRestart?: boolean;
  // The app theme at launch, so the server can start a CLI in the colour scheme
  // the terminal is painted in.
  colorScheme?: 'light' | 'dark';
};

type ShellResizeMessage = {
  type: 'resize';
  cols: number;
  rows: number;
};

type ShellInputMessage = {
  type: 'input';
  data: string;
};

type ShellOutgoingMessage = ShellInitMessage | ShellResizeMessage | ShellInputMessage;

type ShellIncomingMessage =
  | { type: 'output'; data: string }
  // Sent instead of starting a PTY when the project path or session id is
  // rejected, so this is the only signal that the terminal will never start.
  | { type: 'error'; message?: string }
  | { type: 'auth_url'; url?: string }
  // The app theme the Claude CLI in the pty was launched for. A running CLI
  // keeps those colours, including one a reconnect reattaches to.
  | { type: 'claude_theme'; colorScheme?: string }
  | { type: string; [key: string]: unknown };

export type ShellWebSocketTarget = { url: string; protocols: string[] };

/**
 * URL and subprotocols for the shell socket. The JWT rides in
 * Sec-WebSocket-Protocol, never in the URL (see shared/basePath.ts).
 */
export function getShellWebSocketTarget(): ShellWebSocketTarget | null {
  const token = getStoredAuthToken();
  if (!token) {
    console.error('No authentication token found for Shell WebSocket connection');
    return null;
  }

  return { url: webSocketUrl('/shell'), protocols: [WEBSOCKET_AUTH_PROTOCOL, token] };
}

export function parseShellMessage(payload: string): ShellIncomingMessage | null {
  try {
    return JSON.parse(payload) as ShellIncomingMessage;
  } catch {
    return null;
  }
}

export function sendSocketMessage(ws: WebSocket | null, message: ShellOutgoingMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
