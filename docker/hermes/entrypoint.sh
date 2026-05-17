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

# Optional Composio MCP — a per-actor URL minted by
# `scripts/composio-mcp.ts`. We append it instead of templating in
# place so the image doesn't carry a placeholder for it. Single-tenant
# Phase-A wiring: one URL for the pinned CASTLE_ACTOR_SLUG actor.
if [[ -n "${COMPOSIO_MCP_URL:-}" ]]; then
  cat >> "$HERMES_HOME/config.yaml" <<EOF
  composio:
    url: ${COMPOSIO_MCP_URL}
    enabled: true
EOF
  echo "[entrypoint] composio MCP registered" >&2
else
  echo "[entrypoint] COMPOSIO_MCP_URL unset — composio MCP disabled" >&2
fi

# Hermes reads .env from ~/.hermes/.env. Mirror runtime env in.
cat > "$HERMES_HOME/.env" <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
COMPOSIO_API_KEY=${COMPOSIO_API_KEY:-}
EOF

cd /root
exec uvicorn serve:app --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
