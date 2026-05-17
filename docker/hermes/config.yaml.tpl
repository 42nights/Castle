# Hermes config — templated at boot from CASTLE_MCP_URL and
# (optionally) COMPOSIO_MCP_URL. The composio block is appended by
# entrypoint.sh when COMPOSIO_MCP_URL is set, so the URL doesn't have
# to live in the image. See docker/hermes/entrypoint.sh.
model:
  default: claude-opus-4-7
  provider: anthropic

agent:
  max_turns: 60

skills:
  creation_nudge_interval: 15

mcp_servers:
  castle:
    url: __CASTLE_MCP_URL__
    enabled: true
