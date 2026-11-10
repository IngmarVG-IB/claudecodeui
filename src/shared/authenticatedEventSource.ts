import { getStoredAuthToken } from '@/shared/authToken';
import { withBasePath } from '@/shared/basePath';

/**
 * A minimal EventSource replacement that sends the JWT in the Authorization
 * header. The browser's EventSource cannot set headers, which is why upstream
 * put the token in the URL (`?token=`); the Sandlot build accepts the token on
 * HTTP only in the Authorization header, so streaming endpoints are read with
 * fetch and parsed here.
 *
 * Dispatches a MessageEvent per server-sent event (named by its `event:` line,
 * `message` otherwise) and an `error` Event when the stream fails or ends
 * before `close()`.
 */
export class AuthenticatedEventSource extends EventTarget {
  private readonly controller = new AbortController();
  private closed = false;

  constructor(url: string) {
    super();
    void this.run(url);
  }

  close(): void {
    this.closed = true;
    this.controller.abort();
  }

  private async run(url: string): Promise<void> {
    try {
      const token = getStoredAuthToken();
      const response = await fetch(withBasePath(url), {
        cache: 'no-store',
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: this.controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Event stream failed with HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          this.dispatchBlock(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');
        }
      }
      if (buffer.trim()) this.dispatchBlock(buffer);
      if (!this.closed) this.dispatchEvent(new Event('error'));
    } catch {
      if (!this.closed) this.dispatchEvent(new Event('error'));
    }
  }

  private dispatchBlock(block: string): void {
    if (this.closed) return;
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') eventName = value;
      else if (field === 'data') dataLines.push(value);
    }
    if (dataLines.length === 0) return;
    this.dispatchEvent(new MessageEvent(eventName, { data: dataLines.join('\n') }));
  }
}
