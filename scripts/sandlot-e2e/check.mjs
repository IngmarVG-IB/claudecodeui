// End-to-end check of a running Sandlot CloudCLI through the prefix proxy.
//   node check.mjs <password> <wrong-password>
// Needs `ws` (resolved from /opt/cloudcli/node_modules).
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('/opt/cloudcli/package.json');
const WebSocket = require('ws');

const BASE = 'http://127.0.0.1:8080/absproxy/8091';
const WS_BASE = 'ws://127.0.0.1:8080/absproxy/8091';
const [password, wrongPassword] = process.argv.slice(2);
const HEARTBEAT = process.env.CLOUDCLI_HEARTBEAT_FILE;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const json = async (response) => { try { return await response.json(); } catch { return null; } };

// 1. Static files under the prefix, with the prefix written into index.html.
const index = await fetch(`${BASE}/`);
const html = await index.text();
check('GET <base>/ serves index.html with the base path', index.status === 200 && html.includes('window.__CLOUDCLI_BASE_PATH__="/absproxy/8091"') && /src="\/absproxy\/8091\/assets\//.test(html), `status ${index.status}`);
const asset = html.match(/src="(\/absproxy\/8091\/assets\/[^"]+\.js)"/)?.[1];
const assetResponse = asset ? await fetch(`http://127.0.0.1:8080${asset}`) : null;
check('a hashed JS asset loads under the prefix', assetResponse?.status === 200, asset ?? 'no asset');
const deep = await fetch(`${BASE}/session/some-id`);
check('a client route (<base>/session/<id>) gets the SPA shell', deep.status === 200 && (await deep.text()).includes('__CLOUDCLI_BASE_PATH__'));
const outside = await fetch('http://127.0.0.1:8091/api/auth/status');
check('nothing is served outside the base path', outside.status === 404, `status ${outside.status}`);

// 2. Login.
const status = await json(await fetch(`${BASE}/api/auth/status`));
check('auth status is Sandlot mode, no setup', status?.mode === 'sandlot' && status?.needsSetup === false, JSON.stringify(status));
const register = await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'x', password: 'y'.repeat(12) }) });
check('there is no registration endpoint', register.status === 404, `status ${register.status}`);
const wrong = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: wrongPassword }) });
check('login with a wrong password fails (401)', wrong.status === 401, `status ${wrong.status}`);
const right = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
const login = await json(right);
const token = login?.token;
check('login with the right password returns a token', right.status === 200 && typeof token === 'string', `status ${right.status}`);
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
check('the token expires 12 h after issue', claims.exp - claims.iat === 12 * 3600, `${claims.exp - claims.iat}s`);
const auth = { authorization: `Bearer ${token}` };

// 3. Token only in the Authorization header on HTTP.
const viaQuery = await fetch(`${BASE}/api/projects?token=${encodeURIComponent(token)}`);
const viaQueryBody = await json(viaQuery);
check('?token= on HTTP is refused (401)', viaQuery.status === 401 && viaQueryBody?.code === 'AUTH_TOKEN_IN_URL_REFUSED', `status ${viaQuery.status} ${viaQueryBody?.code}`);
const viaBoth = await fetch(`${BASE}/api/projects?token=${encodeURIComponent(token)}`, { headers: auth });
check('?token= is refused even beside a valid header', viaBoth.status === 401, `status ${viaBoth.status}`);
const viaHeader = await fetch(`${BASE}/api/projects`, { headers: auth });
check('the Authorization header is accepted', viaHeader.status === 200, `status ${viaHeader.status}`);
const noAuth = await fetch(`${BASE}/api/projects`);
check('no token is refused', noAuth.status === 401, `status ${noAuth.status}`);

// 4. A project and a session.
const projectPath = process.env.E2E_PROJECT || '/home/se/work';
const created = await json(await fetch(`${BASE}/api/projects/create-project`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ path: projectPath }) }));
check('create-project', created?.success === true, JSON.stringify(created)?.slice(0, 160));
const sessionResponse = await fetch(`${BASE}/api/providers/sessions`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'claude', projectPath, initialMessage: 'e2e check' }) });
const session = await json(sessionResponse);
const sessionId = session?.data?.sessionId;
check('POST /api/providers/sessions creates a session', sessionResponse.status === 201 && Boolean(sessionId), sessionId);
const codex = await fetch(`${BASE}/api/providers/sessions`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'codex', projectPath }) });
check('a codex session is refused', codex.status === 400, `status ${codex.status}`);

// 5. WebSocket: token in Sec-WebSocket-Protocol, through the prefix proxy.
const heartbeatBefore = HEARTBEAT && fs.existsSync(HEARTBEAT) ? fs.statSync(HEARTBEAT).mtimeMs : 0;
const openSocket = (protocols, path = '/ws') => new Promise((resolve, reject) => {
  const socket = new WebSocket(`${WS_BASE}${path}`, protocols);
  socket.once('open', () => resolve(socket));
  socket.once('error', reject);
  socket.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
});
let rejected = null;
try { (await openSocket([])).close(); } catch (error) { rejected = error.message; }
check('a WebSocket without a token is refused', Boolean(rejected), rejected ?? 'opened');
const socket = await openSocket(['cloudcli.bearer', token]);
check('a WebSocket with the token in Sec-WebSocket-Protocol opens', socket.readyState === WebSocket.OPEN, `protocol=${socket.protocol}`);
check('the server echoes cloudcli.bearer, not the token', socket.protocol === 'cloudcli.bearer');
const frames = [];
socket.on('message', (raw) => { try { frames.push(JSON.parse(raw.toString())); } catch {} });
const waitFor = (predicate, timeoutMs) => new Promise((resolve) => {
  const started = Date.now();
  const tick = () => {
    const hit = frames.find(predicate);
    if (hit || Date.now() - started > timeoutMs) { resolve(hit ?? null); return; }
    setTimeout(tick, 100);
  };
  tick();
});
await new Promise((r) => setTimeout(r, 300));
const heartbeatAfterOpen = HEARTBEAT && fs.existsSync(HEARTBEAT) ? fs.statSync(HEARTBEAT).mtimeMs : 0;
check('CLOUDCLI_HEARTBEAT_FILE is touched when a client connects', Boolean(HEARTBEAT) && heartbeatAfterOpen > heartbeatBefore, `${heartbeatBefore} -> ${heartbeatAfterOpen}`);

socket.send(JSON.stringify({ type: 'chat.send', sessionId, content: 'Delete everything', options: { permissionMode: 'bypassPermissions' } }));
const refused = await waitFor((frame) => frame.kind === 'protocol_error', 5000);
check('chat.send with bypassPermissions is refused', refused?.code === 'PERMISSION_MODE_REFUSED', JSON.stringify(refused));
frames.length = 0;
socket.send(JSON.stringify({ type: 'chat.send', sessionId, content: 'Delete everything', options: { toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: true } } }));
const refusedSkip = await waitFor((frame) => frame.kind === 'protocol_error', 5000);
check('chat.send with skipPermissions is refused', refusedSkip?.code === 'PERMISSION_MODE_REFUSED', JSON.stringify(refusedSkip));
frames.length = 0;

socket.send(JSON.stringify({ type: 'chat.send', sessionId, content: 'Say hello.', options: { permissionMode: 'default', model: 'sonnet' } }));
const complete = await waitFor((frame) => frame.kind === 'complete', 120000);
const text = frames.filter((frame) => frame.kind === 'text' || frame.kind === 'stream_delta').map((frame) => frame.content ?? frame.text ?? '').join('');
const errors = frames.filter((frame) => frame.kind === 'error' || frame.kind === 'protocol_error');
check('one chat prompt runs through Claude Code to completion', Boolean(complete) && errors.length === 0, `complete=${JSON.stringify(complete)} errors=${JSON.stringify(errors).slice(0, 300)}`);
check('the stub model answer comes back over the WebSocket', JSON.stringify(frames).includes('Hello from the stub model.'), text.slice(0, 120));
fs.writeFileSync('/tmp/e2e-frames.json', JSON.stringify(frames, null, 2));
socket.close();

// 6. The stub saw the request: managed settings pointed Claude Code at it.
const stubLog = fs.existsSync('/tmp/stub-requests.jsonl') ? fs.readFileSync('/tmp/stub-requests.jsonl', 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
const messageCalls = stubLog.filter((entry) => entry.method === 'POST' && entry.url.startsWith('/v1/messages'));
check('the stub recorded the model request (ANTHROPIC_BASE_URL from managed settings)', messageCalls.length > 0, `${messageCalls.length} /v1/messages call(s), ${stubLog.length} total`);

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
