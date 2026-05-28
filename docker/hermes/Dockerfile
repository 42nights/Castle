# Hermes agent + tiny FastAPI wrapper that exposes /agent for Castle.
# Runs as root so the Railway-mounted volume (root-owned by default) at
# /root/.hermes is writable. Internal-only service in its own microVM.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates git build-essential pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /root
ENV PATH="/root/.local/bin:${PATH}" \
    HOME="/root" \
    PYTHONUNBUFFERED=1

# Hermes installer drops `hermes` into ~/.local/bin and scaffolds
# ~/.hermes/. Railway will mount its volume over /root/.hermes at
# runtime, but the `hermes` binary lives in /root/.local/bin which
# is NOT under the mount — survives.
RUN curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash

# FastAPI wrapper deps. httpx is for outbound calls to Convex from the
# new long-running streaming path (agentTurns / agentMessageChunks).
# composio (v3 SDK) mints per-user MCP sessions in serve.py — replaces
# the deprecated long-lived hosted-MCP UUID URL.
RUN pip install --no-cache-dir \
      fastapi==0.115.0 \
      "uvicorn[standard]==0.30.0" \
      httpx==0.28.1 \
      composio

# Templates live OUTSIDE the volume mount path so they survive when
# Railway overlays /root/.hermes with the persistent volume. Entrypoint
# copies them in on every boot.
COPY docker/hermes/SOUL.md /opt/castle/SOUL.md
COPY docker/hermes/config.yaml.tpl /opt/castle/config.yaml.tpl
COPY docker/hermes/serve.py /root/serve.py
COPY docker/hermes/turn_token.py /root/turn_token.py
COPY docker/hermes/convex_client.py /root/convex_client.py
COPY docker/hermes/entrypoint.sh /root/entrypoint.sh
RUN chmod +x /root/entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/root/entrypoint.sh"]
