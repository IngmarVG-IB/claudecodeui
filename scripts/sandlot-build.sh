#!/bin/bash
# Builds the Sandlot CloudCLI from a clean checkout into a self-contained
# directory: copy it to /opt/cloudcli and start it with
#   node /opt/cloudcli/dist-server/server/index.js
#
# Expects Linux with Node 22, a C++ toolchain and python3 (Sandlot builds in
# amazonlinux:2023 with nodejs22, nodejs22-devel or network access for node
# headers, gcc-c++, make, python3). Packages are fetched from the npm registry
# at build time only; nothing downloads at run time.
#
#   scripts/sandlot-build.sh            build in place (the checkout root)
#   SANDLOT_BUILD_KEEP_DEV=1 ...        stop before pruning dev dependencies
#                                       (to run npm test / typecheck / lint)
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)

say() { printf '[sandlot-build] %s\n' "$*"; }
die() { printf '[sandlot-build] ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = Linux ] || die "build on Linux (the native modules are built for the host)"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" = 22 ] || die "Node 22 required, found $(node --version)"
command -v make >/dev/null || die "make is required"
command -v g++ >/dev/null || die "g++ is required"
command -v python3 >/dev/null || die "python3 is required"

# 1. Dependencies, with every install script off: no postinstall download of
#    ripgrep, prebuilt binaries or anything else.
say "npm ci --ignore-scripts"
npm ci --ignore-scripts --no-audit --no-fund

# 2. Native modules, built from source with node-gyp (never prebuild-install).
NODE_GYP="$ROOT/node_modules/node-gyp/bin/node-gyp.js"
[ -f "$NODE_GYP" ] || die "node-gyp is missing from devDependencies"
GYP_ARGS=(rebuild --release)
NODE_PREFIX=$(dirname "$(dirname "$(command -v node)")")
if [ -f "$NODE_PREFIX/include/node/node.h" ]; then
  GYP_ARGS+=("--nodedir=$NODE_PREFIX")
  say "node headers: $NODE_PREFIX/include/node"
else
  say "node headers not installed locally; node-gyp fetches them for v$(node -p process.versions.node)"
fi
for module in better-sqlite3 node-pty; do
  say "building $module from source"
  (cd "node_modules/$module" && node "$NODE_GYP" "${GYP_ARGS[@]}")
done
# node-pty ships prebuilt binaries; drop them so only the one built here loads.
rm -rf node_modules/node-pty/prebuilds
node -e "require('better-sqlite3')(':memory:').prepare('select 1').get()" || die "better-sqlite3 does not load"
node -e "require('node-pty')" || die "node-pty does not load"

# 3. Client and server bundles.
say "npm run build"
npm run build

if [ "${SANDLOT_BUILD_KEEP_DEV:-}" = 1 ]; then
  say "SANDLOT_BUILD_KEEP_DEV=1: leaving dev dependencies in place"
  exit 0
fi

# 4. Runtime dependencies only.
say "npm prune --omit=dev"
npm prune --omit=dev --ignore-scripts --no-audit --no-fund

# 5. No Claude Code copy but the one CLAUDE_CLI_PATH names. The Agent SDK
#    brings the CLI as optional per-platform packages
#    (@anthropic-ai/claude-agent-sdk-<platform>-<arch>[-musl]); the server
#    always passes pathToClaudeCodeExecutable, and these are deleted so there
#    is nothing to fall back to.
say "removing bundled Claude Code binaries"
rm -rf node_modules/@anthropic-ai/claude-agent-sdk-*
rm -rf node_modules/@anthropic-ai/claude-code
leftovers=$(find node_modules \( -path '*/@anthropic-ai/claude-agent-sdk-*' -o -path '*/@anthropic-ai/claude-code' \
  -o \( -type f \( -name claude -o -name claude.exe \) \) -o \( -type f -name cli.js -path '*@anthropic-ai*' \) \) -print)
[ -z "$leftovers" ] || die "a Claude Code copy is still in the tree: $leftovers"

# 6. Build-only leftovers.
rm -rf dist-server.next dist-server.old node_modules/.cache

[ -f dist-server/server/index.js ] || die "dist-server/server/index.js was not built"
[ -f dist/index.html ] || die "dist/index.html was not built"
say "done: node $ROOT/dist-server/server/index.js"
