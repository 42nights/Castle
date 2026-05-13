# Hermes config — templated at boot from CASTLE_MCP_URL.
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
