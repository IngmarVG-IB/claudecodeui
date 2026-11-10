#!/bin/bash
# Runs inside the runtime container as root, then drops to uid 1000.
set -euo pipefail
PASSWORD='correct horse battery staple'
HASH=$(printf %s "$PASSWORD" | sha256sum | cut -d' ' -f1)

id se >/dev/null 2>&1 || useradd -u 1000 -m -d /home/se se
install -d -o se -g se /home/se/work /home/se/run
install -m 0755 /claude-bin /usr/local/lib/claude-2.1.295
install -d /etc/claude-code
cat > /etc/claude-code/managed-settings.json <<'JSON'
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:9999",
    "ANTHROPIC_API_KEY": "sk-ant-api03-stub-0000000000000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "DISABLE_AUTOUPDATER": "1"
  },
  "permissions": { "disableBypassPermissionsMode": "disable" }
}
JSON

runuser -u se -- node /e2e/stub.mjs > /tmp/stub.log 2>&1 &
runuser -u se -- node /e2e/proxy.mjs > /tmp/proxy.log 2>&1 &

ENVV=(HOME=/home/se USER=se PATH=/usr/bin:/bin HOST=127.0.0.1 SERVER_PORT=8091 CLOUDCLI_BASE_PATH=/absproxy/8091
  SANDLOT_PASSWORD_SHA256="$HASH" CLAUDE_CLI_PATH=/usr/local/lib/claude-2.1.295
  CLOUDCLI_HEARTBEAT_FILE=/home/se/run/cloudcli.heartbeat DATABASE_PATH=/home/se/.local/share/cloudcli/)

echo "== refuses to start without SANDLOT_PASSWORD_SHA256"
set +e
runuser -u se -- env -i HOME=/home/se PATH=/usr/bin:/bin CLAUDE_CLI_PATH=/usr/local/lib/claude-2.1.295 node /opt/cloudcli/dist-server/server/index.js > /tmp/refuse1.log 2>&1; echo "exit $?"; head -3 /tmp/refuse1.log
echo "== refuses to start with a malformed hash"
runuser -u se -- env -i HOME=/home/se PATH=/usr/bin:/bin SANDLOT_PASSWORD_SHA256=ABC CLAUDE_CLI_PATH=/usr/local/lib/claude-2.1.295 node /opt/cloudcli/dist-server/server/index.js > /tmp/refuse2.log 2>&1; echo "exit $?"; head -3 /tmp/refuse2.log
echo "== refuses to start with CLAUDE_CLI_PATH=claude"
runuser -u se -- env -i HOME=/home/se PATH=/usr/bin:/bin SANDLOT_PASSWORD_SHA256="$HASH" CLAUDE_CLI_PATH=claude node /opt/cloudcli/dist-server/server/index.js > /tmp/refuse3.log 2>&1; echo "exit $?"; head -3 /tmp/refuse3.log
set -e

echo "== start as uid 1000"
runuser -u se -- env -i "${ENVV[@]}" node /opt/cloudcli/dist-server/server/index.js > /tmp/server.log 2>&1 &
for i in $(seq 1 60); do curl -fsS -o /dev/null http://127.0.0.1:8091/absproxy/8091/health 2>/dev/null && break; sleep 1; done
echo "server process:"; ps -o user,uid,pid,args -C node | grep dist-server || true
echo "listening sockets:"; ss -ltnp | grep -E ':(8091|8080|9999)\b' || true

echo "== e2e checks"
set +e
runuser -u se -- env HOME=/home/se CLOUDCLI_HEARTBEAT_FILE=/home/se/run/cloudcli.heartbeat node /e2e/check.mjs "$PASSWORD" 'not the password'
E2E=$?
set -e

echo "== database permissions"
stat -c '%a %U %n' /home/se/.local/share/cloudcli /home/se/.local/share/cloudcli/auth.db
echo "== claude binaries in the tree and on the system (excluding the pinned one)"
find /opt/cloudcli -type f \( -name claude -o -name claude.exe \) -print
find /opt/cloudcli -path '*@anthropic-ai/claude-agent-sdk-*' -prune -print
find / -xdev -type f -name 'claude' -not -path '/proc/*' -print 2>/dev/null
echo "processes that ran Claude Code (from server log):"; grep -c "" /tmp/server.log >/dev/null; tail -20 /tmp/server.log
echo "== stub requests"; cat /tmp/stub-requests.jsonl 2>/dev/null | head -5
exit $E2E
