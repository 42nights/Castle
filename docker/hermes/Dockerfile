# Hermes agent + tiny FastAPI wrapper that exposes /agent for Castle.
FROM python:3.11-slim

# Build essentials the Hermes installer needs (sqlite, git, curl, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates git build-essential pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 hermes
USER hermes
WORKDIR /home/hermes
ENV PATH="/home/hermes/.local/bin:${PATH}" \
    HOME="/home/hermes" \
    PYTHONUNBUFFERED=1

# Official Hermes installer — drops `hermes` into ~/.local/bin and
# scaffolds ~/.hermes/. Idempotent.
RUN curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash

# Tiny HTTP wrapper around `hermes -z`. Castle on Vercel hits /agent
# with NDJSON streaming back. fastapi + uvicorn is enough.
RUN pip install --user --no-cache-dir fastapi==0.115.0 uvicorn[standard]==0.30.0

# Persona + config — config.yaml.tpl has __CASTLE_MCP_URL__ which
# entrypoint.sh templates at boot from $CASTLE_MCP_URL.
COPY --chown=hermes:hermes docker/hermes/SOUL.md /home/hermes/.hermes/SOUL.md
COPY --chown=hermes:hermes docker/hermes/config.yaml.tpl /home/hermes/.hermes/config.yaml.tpl
COPY --chown=hermes:hermes docker/hermes/serve.py /home/hermes/serve.py
COPY --chown=hermes:hermes docker/hermes/entrypoint.sh /home/hermes/entrypoint.sh

# Volume mount point — when Railway mounts the volume at
# /home/hermes/.hermes, we want it to land empty so we re-seed config
# from the template on every boot. Sessions / memory / skills persist
# inside, but config + SOUL.md are written fresh.
USER root
RUN chmod +x /home/hermes/entrypoint.sh
USER hermes

EXPOSE 8000
ENTRYPOINT ["/home/hermes/entrypoint.sh"]
