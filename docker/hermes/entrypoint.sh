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
  # Composio's hosted MCP endpoint requires an API key header (401 without).
  # Pass it via the headers map Hermes' MCP loader honors. Without this,
  # `discover_mcp_tools()` at startup logs "401 Unauthorized" and Hermes
  # registers 0 tools from this server.
  if [[ -n "${COMPOSIO_API_KEY:-}" ]]; then
    cat >> "$HERMES_HOME/config.yaml" <<EOF
  composio:
    url: ${COMPOSIO_MCP_URL}
    headers:
      x-api-key: ${COMPOSIO_API_KEY}
    enabled: true
EOF
    echo "[entrypoint] composio MCP registered (auth header set)" >&2
  else
    cat >> "$HERMES_HOME/config.yaml" <<EOF
  composio:
    url: ${COMPOSIO_MCP_URL}
    enabled: true
EOF
    echo "[entrypoint] composio MCP registered (no API key — auth will fail)" >&2
  fi
else
  echo "[entrypoint] COMPOSIO_MCP_URL unset — composio MCP disabled" >&2
fi

# Echo the rendered config (with secrets redacted) so we can sanity-check
# what Hermes actually loads.
echo "[entrypoint] config.yaml ---" >&2
sed 's/\(x-api-key:\) [^ ]*/\1 REDACTED/' "$HERMES_HOME/config.yaml" >&2
echo "[entrypoint] ---" >&2

# Hermes reads .env from ~/.hermes/.env. Mirror runtime env in.
cat > "$HERMES_HOME/.env" <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
COMPOSIO_API_KEY=${COMPOSIO_API_KEY:-}
EOF

cd /root
exec uvicorn serve:app --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
