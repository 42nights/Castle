# Castle MCP server — Node + tsx, exposes Convex mutations / Composio
# OAuth proposer / entity CRUD as MCP tools. Hermes consumes this over
# Streamable HTTP at /mcp.
FROM node:22-alpine

# tini for proper signal handling under Railway's container runtime
RUN apk add --no-cache tini

WORKDIR /app
ENV NODE_ENV=development \
    PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME:$PATH"

# pnpm via corepack so the lockfile version is honored
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# Install deps with the lockfile so transitive versions match local.
# We need devDependencies too — tsx is in dev, and the MCP SDK ships
# alongside the runtime imports.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# App code. Only what the MCP needs at runtime; no app/, no public/.
COPY convex ./convex
COPY lib ./lib
COPY scripts ./scripts

EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "tsx", "scripts/castle-mcp.ts", "--http", "3001"]
