// A prefix-keeping reverse proxy like code-server's /absproxy/<port>/:
// forwards /absproxy/8091/... to 127.0.0.1:8091 with the path unchanged,
// WebSocket upgrades included.
import http from 'node:http';
import net from 'node:net';

const PREFIX = '/absproxy/8091';
const TARGET = { host: '127.0.0.1', port: 8091 };

const server = http.createServer((req, res) => {
  if (!req.url.startsWith(PREFIX)) { res.writeHead(404); res.end('proxy: not under prefix'); return; }
  const upstream = http.request({ ...TARGET, method: req.method, path: req.url, headers: { ...req.headers, host: `${TARGET.host}:${TARGET.port}` } }, (up) => {
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  upstream.on('error', (error) => { res.writeHead(502); res.end(String(error)); });
  req.pipe(upstream);
});
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith(PREFIX)) { socket.destroy(); return; }
  const upstream = net.connect(TARGET.port, TARGET.host, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(lines.join('\r\n') + '\r\n\r\n');
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
});
server.listen(8080, '127.0.0.1', () => console.log('proxy listening on 127.0.0.1:8080'));
