/**
 * Writes CLOUDCLI_BASE_PATH into the built index.html.
 *
 * Vite builds with `base: './'`, so the document references its scripts,
 * styles, icons and manifest as "./...". Those would resolve against the
 * current client route (e.g. <base>/session/abc/), so they are rewritten to
 * absolute paths under the base path. A small inline script hands the base
 * path to the client (shared/basePath.ts) and to React Router.
 */
export function renderIndexHtml(html: string, basePath: string): string {
  const prefix = `${basePath}/`;
  const rewritten = html.replace(/(\s(?:src|href)=)(["'])\.\//g, (_match, attribute: string, quote: string) => (
    `${attribute}${quote}${prefix}`
  ));
  // basePath is validated against /^(\/[A-Za-z0-9._~-]+)+$/, so JSON encoding
  // is enough to make it a safe script literal.
  const literal = JSON.stringify(basePath);
  const script = `<script>window.__CLOUDCLI_BASE_PATH__=${literal};window.__ROUTER_BASENAME__=${literal};</script>`;
  return rewritten.includes('</head>')
    ? rewritten.replace('</head>', `    ${script}\n  </head>`)
    : `${script}${rewritten}`;
}
