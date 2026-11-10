# CloudCLI, Sandlot build

A hardened build of [CloudCLI / claudecodeui](https://github.com/siteboon/claudecodeui) (AGPL-3.0-or-later) that runs
as the optional chat view in a Sandlot workspace: one ECS Fargate task per person, uid 1000, no internet egress,
Claude Code pinned to a model gateway by `/etc/claude-code/managed-settings.json`, and reached only through
code-server's authenticated port proxy at `http://localhost:8080/absproxy/8091/`.

Source: branch `sandlot` of https://github.com/IngmarVG-IB/claudecodeui. Upstream history and what was taken
from it: [CATCH-UP.md](CATCH-UP.md).

## What changed and why

| Area | Change | Why |
|---|---|---|
| Providers | Claude only. Codex, Cursor, OpenCode (and Gemini, already gone upstream) removed: server, routes, UI, deps (`@openai/codex`, `@openai/codex-sdk`, `@opencode-ai/sdk`). | Sandlot pins one agent to one gateway. |
| Claude Code | `CLAUDE_CLI_PATH` is required, checked at startup, and passed as `pathToClaudeCodeExecutable` on every SDK call (chat, side questions); the Shell tab launches the same path. No PATH or node_modules search. The build deletes the SDK's bundled per-platform binaries. | The pinned binary and its managed settings are the only Claude Code that runs. |
| Permissions | Modes `default`, `acceptEdits`, `plan` only. The chat gateway answers `protocol_error` `PERMISSION_MODE_REFUSED` for `bypassPermissions`, `auto`, `dontAsk` or any `skipPermissions`; the runtime asserts it again. Bypass toggles removed from Settings, composer and Shell (no `--dangerously-skip-permissions`). Commit-message generation no longer runs in bypass mode. | Every tool call outside the allow-list reaches the person. |
| Auth | One user. `SANDLOT_PASSWORD_SHA256` only: `sha256(password)` compared in constant time; no registration, no stored password, no bcrypt. JWT secret random per process (a restart signs everyone out); tokens last 12 h, no refresh. HTTP: `Authorization: Bearer` only, `?token=` refused (401 `AUTH_TOKEN_IN_URL_REFUSED`). WebSocket: `Sec-WebSocket-Protocol: cloudcli.bearer, <jwt>` (preferred) or `?token=`. Platform-mode bypass, API-key middleware and `/api/agent` removed. No CORS. | The token never sits in a URL on HTTP; nothing bypasses login. |
| Network | No update checks, GitHub API calls, Google Fonts, service worker, web push, webhooks, Discord/marketing links, telemetry overlay (react-scan). `scripts/check-no-external-hosts.mjs` (run by `npm test`) fails on a non-loopback host in server or client code outside documentation links. | No egress; nothing should try. |
| Removed features | Every update path (git pull / npm install / restart endpoint, `cloudcli` CLI with its update check, `useVersionCheck`, `VersionUpgradeModal`, CLI updater in Settings, release tooling), voice (proxy and UI), the plugin system (git install/update, plugin servers and WebSocket proxy), TaskMaster (it ran `npx task-master`), browser-use and its MCP bridge, notifications (Web Push, desktop, webhook), GitHub/GitLab project creation and cloning (`@octokit/rest`, token store), API keys and credentials store, Electron desktop app, Docker images. | Each one either downloads, calls out, or adds a second way in. |
| Base path | `CLOUDCLI_BASE_PATH` prefixes static files, API, `/ws` and `/shell`; anything outside it is 404. Vite builds with a relative base; the server writes the prefix into `index.html` (`window.__CLOUDCLI_BASE_PATH__`, `window.__ROUTER_BASENAME__`). The client sends every same-origin URL through `withBasePath`. | code-server's `/absproxy/<port>/` keeps the prefix when forwarding, WebSocket upgrades included. |
| Idle watchdog | `CLOUDCLI_HEARTBEAT_FILE` touched at once and every 30 s while at least one authenticated chat or shell WebSocket is open. | The workspace's idle watchdog reads its mtime. |
| Data | Database directory 0700, file 0600 (set explicitly, not by umask, which Claude Code would inherit). | Per-user state stays private. |
| Search | Ripgrep from `CLOUDCLI_RG_PATH`, else `rg` on PATH; `@vscode/ripgrep` (postinstall download) removed. | Sandlot passes code-server's bundled rg. |
| Licence | `LICENSE` and `NOTICE` kept; Settings > About and the login screen link to the source of this build. | AGPL-3.0 section 13. |

`settingSources` stays `['project', 'user', 'local']`. Managed (policy) settings are not one of the selectable
sources: the Agent SDK typings (0.3.311, `ResolveSettingsOptions.settingSources`) say "Pass `[]` to skip
user/project/local sources — the managed-settings policy tier is still read from disk", and the Docker check
below confirms it in practice: `ANTHROPIC_BASE_URL` set only in `/etc/claude-code/managed-settings.json` routed
the chat turn to the stub. Side questions run with `settingSources: []` and `permissionMode: 'dontAsk'` (upstream).

## Environment contract

The server checks all of it before any other module loads and exits 1, listing every problem, if a value is
missing or malformed (`server/sandlot/config.ts`).

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `HOST` | no | `127.0.0.1` | Bind address. |
| `SERVER_PORT` | no | `3001` | TCP port (Sandlot: `8091`). |
| `CLOUDCLI_BASE_PATH` | no | `''` (root) | Prefix such as `/absproxy/8091`; segments of `[A-Za-z0-9._~-]`, trailing slash ignored. |
| `SANDLOT_PASSWORD_SHA256` | **yes** | | `printf %s "$PASSWORD" \| sha256sum`: exactly 64 lowercase hex. |
| `CLAUDE_CLI_PATH` | **yes** | | Absolute path to an executable regular file (symlinks resolved). |
| `CLOUDCLI_HEARTBEAT_FILE` | no | unset (no heartbeat) | Absolute path (`~/` expanded); created 0600 if missing. |
| `DATABASE_PATH` | no | `~/.local/share/cloudcli/auth.db` | SQLite file, or a directory (existing, or ending in `/`) for `auth.db` in it. |
| `CLOUDCLI_RG_PATH` | no | `rg` on PATH | Absolute path to an executable ripgrep. |

Not read any more: `JWT_SECRET`, `API_KEY`, `VITE_IS_PLATFORM`.

## HTTP and WebSocket surface (for scripted checks)

All paths below are under `CLOUDCLI_BASE_PATH` (`<base>`).

- `GET <base>/health`: public, `{ status: 'ok', mode: 'sandlot', version }`.
- `GET <base>/api/auth/status`: public, `{ needsSetup: false, isAuthenticated: false, mode: 'sandlot' }`.
- `POST <base>/api/auth/login`, body `{"password": "..."}` -> `200 { success, user, token }` or `401` (after a 750 ms delay).
- `POST <base>/api/projects/create-project`, body `{"path": "/home/se/work"}`.
- `POST <base>/api/providers/sessions`, body `{"provider": "claude", "projectPath": "/home/se/work", "initialMessage": "..."}` -> `201 { success, data: { sessionId, ... } }`.
- `WS <base>/ws` with subprotocols `["cloudcli.bearer", "<token>"]`; send
  `{"type": "chat.send", "sessionId": "<id>", "content": "Say hello.", "options": {"permissionMode": "default"}}`.
  Frames come back as JSON with a `kind` (`text`, `stream_delta`, `tool_use`, `permission_request`, ...); the turn
  ends with `{"kind": "complete", ...}`. A refused mode answers `{"kind": "protocol_error", "code": "PERMISSION_MODE_REFUSED"}`.
  A `permission_request` is answered with `{"type": "chat.permission-response", "requestId": "...", "allow": true}`.
- `WS <base>/shell`: same subprotocol auth.

## Build

On Linux with Node 22, `gcc-c++`, `make`, `python3` (Sandlot: `amazonlinux:2023` with `nodejs22 nodejs22-npm
nodejs22-devel gcc-c++ make python3`):

```
scripts/sandlot-build.sh
cp -a . /opt/cloudcli          # or copy the checkout directory
node /opt/cloudcli/dist-server/server/index.js
```

The script runs `npm ci --ignore-scripts` (no install scripts at all), builds `better-sqlite3` and `node-pty` from
source with node-gyp (local headers from `nodejs22-devel` when present; node-pty's prebuilds are deleted),
`npm run build`, `npm prune --omit=dev`, deletes `@anthropic-ai/claude-agent-sdk-*` and fails if any Claude Code
copy is left in `node_modules`. Packages come from the npm registry at build time; nothing downloads at run time.
`SANDLOT_BUILD_KEEP_DEV=1` stops before pruning, for `npm test`, `npm run typecheck`, `npx vitest run`, `npm run lint`.

## Not covered

- The Shell tab is a full terminal (as upstream). It starts the pinned Claude Code without bypass, but a person can
  type `claude --dangerously-skip-permissions` there as in any workspace terminal; set
  `"permissions": {"disableBypassPermissionsMode": "disable"}` in managed settings to close that in the CLI.
- The external-host guard looks for URLs with a scheme; a host assembled from parts at run time is not caught.
- Settings > Agents still shows Claude's login status and can open `claude /login` in a terminal; behind the
  gateway it is not needed and would fail without egress.

## Verification

`scripts/sandlot-e2e/` holds the Docker check run for release `sandlot-1.37.8-s1` (arm64): `Dockerfile.base`
(amazonlinux:2023 + nodejs22, nodejs22-devel, gcc-c++, make, python3), `run-e2e.sh` (runs as root in a container
holding `/opt/cloudcli`, `/e2e` = this folder and `/claude-bin` = a Claude Code linux binary; writes
`/etc/claude-code/managed-settings.json` with `ANTHROPIC_BASE_URL=http://127.0.0.1:9999`, starts `stub.mjs`, the
prefix-keeping `proxy.mjs` on 127.0.0.1:8080 and the server as uid 1000), and `check.mjs` (25 checks through
`/absproxy/8091`). Result on 2026-11-10 with Claude Code 2.1.295: 25/25, bound to 127.0.0.1:8091 only, database
dir 700 / file 600, no Claude Code binary in `/opt/cloudcli`.
