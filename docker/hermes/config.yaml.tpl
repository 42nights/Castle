# Hermes config — CASTLE_MCP_URL is templated in by entrypoint.sh.
# Composio MCP isn't listed here; it's registered per-session in
# serve.py via the v3 SDK (`composio.create(user_id).mcp.url`).
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
