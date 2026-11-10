/**
 * The path prefix the app is served under (CLOUDCLI_BASE_PATH on the server,
 * e.g. `/absproxy/8091`), or '' at the domain root.
 *
 * The server writes it into index.html as `window.__CLOUDCLI_BASE_PATH__`
 * (and `window.__ROUTER_BASENAME__` for React Router). Every same-origin URL
 * the client builds goes through `withBasePath`, so API calls, WebSockets and
 * static assets all stay under the prefix that code-server's proxy forwards.
 */
const readBasePath = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  const value = (window as Window & { __CLOUDCLI_BASE_PATH__?: unknown }).__CLOUDCLI_BASE_PATH__;
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return '';
  }
  return value.replace(/\/+$/, '');
};

export const BASE_PATH = readBasePath();

/** Prefixes a root-relative path (`/api/...`, `/ws`) with BASE_PATH; any other URL is returned as is. */
export const withBasePath = (path: string): string => {
  if (!path.startsWith('/') || path.startsWith('//')) {
    return path;
  }
  if (BASE_PATH && (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`))) {
    return path;
  }
  return `${BASE_PATH}${path}`;
};

/** ws:// or wss:// URL for a root-relative WebSocket path on the origin that served the page. */
export const webSocketUrl = (path: string): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${withBasePath(path)}`;
};

/**
 * Subprotocol that carries the JWT on a WebSocket upgrade: the client offers
 * `[WEBSOCKET_AUTH_PROTOCOL, <token>]` and the server selects the first, so
 * the token never appears in a URL.
 */
export const WEBSOCKET_AUTH_PROTOCOL = 'cloudcli.bearer';
