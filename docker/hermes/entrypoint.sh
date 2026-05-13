#!/usr/bin/env bash
set -euo pipefail

HERMES_HOME="${HOME}/.hermes"
mkdir -p "$HERMES_HOME"

# Always seed SOUL.md from the image — Castle persona, not Hermes default.
cp -f /home/hermes/.hermes/SOUL.md "$HERMES_HOME/SOUL.md" 2>/dev/null || true

# Template config.yaml from CASTLE_MCP_URL on every boot. If the volume
# already has a config from a previous deploy, we overwrite to pick up
# any URL change.
sed "s|__CASTLE_MCP_URL__|${CASTLE_MCP_URL:-http://localhost:3001/mcp}|g" \
    /home/hermes/.hermes/config.yaml.tpl > "$HERMES_HOME/config.yaml"

# Hermes reads .env from ~/.hermes/.env. Mirror runtime env in.
cat > "$HERMES_HOME/.env" <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
COMPOSIO_API_KEY=${COMPOSIO_API_KEY:-}
EOF

# Run the HTTP wrapper. uvicorn binds to $PORT (Railway sets it) or 8000.
exec uvicorn serve:app --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
