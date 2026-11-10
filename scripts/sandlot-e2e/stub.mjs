// Stub model endpoint for the e2e check: records every request, answers
// /v1/messages with a minimal Anthropic SSE stream.
import fs from 'node:fs';
import http from 'node:http';

const LOG = process.env.STUB_LOG || '/tmp/stub-requests.jsonl';
const REPLY = 'Hello from the stub model.';

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), method: req.method, url: req.url, headers: { 'x-api-key': req.headers['x-api-key'] ? '(set)' : undefined, authorization: req.headers.authorization ? '(set)' : undefined }, bodyBytes: body.length, model: (() => { try { return JSON.parse(body).model; } catch { return undefined; } })(), stream: (() => { try { return JSON.parse(body).stream; } catch { return undefined; } })() }) + '\n');
    const url = new URL(req.url, 'http://stub');
    if (req.method === 'POST' && url.pathname === '/v1/messages/count_tokens') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ input_tokens: 10 }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/messages') {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch {}
      const model = parsed.model || 'claude-sonnet-4-5';
      const id = `msg_stub_${Date.now()}`;
      if (parsed.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'request-id': 'req_stub' });
        res.write(sse('message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }));
        res.write(sse('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }));
        res.write(sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: REPLY } }));
        res.write(sse('content_block_stop', { type: 'content_block_stop', index: 0 }));
        res.write(sse('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 8 } }));
        res.write(sse('message_stop', { type: 'message_stop' }));
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json', 'request-id': 'req_stub' });
      res.end(JSON.stringify({ id, type: 'message', role: 'assistant', model, content: [{ type: 'text', text: REPLY }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 8 } }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'stub' } }));
  });
}).listen(9999, '127.0.0.1', () => console.log('stub listening on 127.0.0.1:9999'));
