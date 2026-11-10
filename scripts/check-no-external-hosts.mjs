#!/usr/bin/env node
/**
 * Sandlot guard: fails when server or client code references a host other
 * than loopback, outside documentation links.
 *
 * A Sandlot workspace has no internet egress and the chat view must not try:
 * no update checks, CDNs, telemetry, webhooks or "star us" badges. This scans
 * the server (server/, shared/) and client (src/, index.html, vite.config.js)
 * sources for URLs with a scheme and checks each host:
 *
 *   allowed   loopback (localhost, 127.0.0.0/8, ::1), reserved example names
 *             (example.com/.net/.org, *.example, *.invalid, *.test, *.localhost),
 *             documentation ranges (192.0.2.0/24, 198.51.100.0/24,
 *             203.0.113.0/24, 2001:db8::/32), XML namespace URIs (w3.org),
 *             and the documentation links in DOCUMENTATION_LINKS below
 *   ignored   tests (tests/, *.test.*), translation catalogues, and comment
 *             lines (a URL in a comment is a citation, not a request)
 *
 * Run with `npm run test:hosts`; `npm test` runs it after the unit tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = ['server', 'shared', 'src', 'index.html', 'vite.config.js'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html', '.css']);

/** Links a person may click to read; the app never fetches them. */
const DOCUMENTATION_LINKS = [
  // AGPL-3.0 section 13 source offer (src/shared/sandlotLinks.ts).
  'https://github.com/IngmarVG-IB/claudecodeui/tree/sandlot',
];

const URL_PATTERN = /\b(?:https?|wss?|ftp):\/\/(\[[0-9a-fA-F:.]+\]|[A-Za-z0-9.-]+)(?::\d+)?[^\s'"`)<>\\]*/g;

function isAllowedHost(rawHost) {
  const host = rawHost.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(host) || host === '::1') return true;
  if (/^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/.test(host)) return true;
  if (host.startsWith('2001:db8:')) return true;
  if (['example.com', 'example.net', 'example.org'].includes(host)) return true;
  if (/\.(example|invalid|test)$/.test(host) || /\.example\.(com|net|org)$/.test(host)) return true;
  if (host === 'www.w3.org') return true;
  return false;
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('<!--');
}

function* walk(target) {
  const full = path.join(ROOT, target);
  if (!fs.existsSync(full)) return;
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    yield full;
    return;
  }
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'tests' || entry.name === '__tests__') continue;
    if (entry.name === 'locales') continue;
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) {
      yield* walk(child);
    } else if (EXTENSIONS.has(path.extname(entry.name)) && !/\.test\.[cm]?[jt]sx?$/.test(entry.name)) {
      yield path.join(ROOT, child);
    }
  }
}

const findings = [];
let scanned = 0;
for (const target of SCAN) {
  for (const file of walk(target)) {
    scanned += 1;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (isCommentLine(line)) return;
      for (const match of line.matchAll(URL_PATTERN)) {
        const [url, host] = match;
        if (isAllowedHost(host)) continue;
        if (DOCUMENTATION_LINKS.some((link) => url === link || url.startsWith(`${link}/`))) continue;
        findings.push(`${path.relative(ROOT, file)}:${index + 1}: ${url}`);
      }
    });
  }
}

if (findings.length > 0) {
  console.error(`check-no-external-hosts: ${findings.length} non-loopback host reference(s) outside documentation links:`);
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log(`check-no-external-hosts: ok (${scanned} files, no non-loopback hosts outside documentation links)`);
