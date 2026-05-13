#!/usr/bin/env bash
set -euo pipefail

HERMES_HOME="${HOME}/.hermes"
mkdir -p "$HERMES_HOME"

# Seed persona + config.yaml from template every boot. Templates live
# under /opt/castle (outside the Railway volume mount), so they survive
# the overlay at /root/.hermes.
cp -f /opt/castle/SOUL.md "$HERMES_HOME/SOUL.md"
sed "s|__CASTLE_MCP_URL__|${CASTLE_MCP_URL:-http://localhost:3001/mcp}|g" \
    /opt/castle/config.yaml.tpl > "$HERMES_HOME/config.yaml"

# Hermes reads .env from ~/.hermes/.env. Mirror runtime env in.
cat > "$HERMES_HOME/.env" <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
COMPOSIO_API_KEY=${COMPOSIO_API_KEY:-}
EOF

cd /root
exec uvicorn serve:app --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
