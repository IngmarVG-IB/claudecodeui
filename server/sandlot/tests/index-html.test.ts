import assert from 'node:assert/strict';
import test from 'node:test';

import { renderIndexHtml } from '@/sandlot/index-html.js';

const built = `<!doctype html><html><head>
<link rel="icon" href="./favicon.svg" />
<script type="module" crossorigin src="./assets/index-abc.js"></script>
<link rel="stylesheet" href="./assets/index-abc.css">
</head><body><a href="https://example.invalid/x">x</a></body></html>`;

test('relative references move under the base path and the base path is handed to the client', () => {
  const html = renderIndexHtml(built, '/absproxy/8091');
  assert.match(html, /href="\/absproxy\/8091\/favicon.svg"/);
  assert.match(html, /src="\/absproxy\/8091\/assets\/index-abc.js"/);
  assert.match(html, /href="\/absproxy\/8091\/assets\/index-abc.css"/);
  assert.match(html, /window.__CLOUDCLI_BASE_PATH__="\/absproxy\/8091"/);
  assert.match(html, /window.__ROUTER_BASENAME__="\/absproxy\/8091"/);
  assert.match(html, /href="https:\/\/example.invalid\/x"/, 'absolute URLs are left alone');
});

test('at the root the references become root-absolute', () => {
  const html = renderIndexHtml(built, '');
  assert.match(html, /src="\/assets\/index-abc.js"/);
  assert.match(html, /window.__CLOUDCLI_BASE_PATH__=""/);
});
