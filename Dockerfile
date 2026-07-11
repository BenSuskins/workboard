# One image serves both compose services: the Next.js web app (`npm run start -w apps/web`)
# and the MCP server (`npx tsx packages/mcp/src/http.ts`) — see docker-compose.yml.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# toolchain only as a fallback: better-sqlite3 normally downloads a prebuilt binary
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/mcp/package.json packages/mcp/
RUN npm ci

FROM deps AS build
# source over the dependency tree (.dockerignore keeps local node_modules/.next/data out)
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/web

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    WORKBOARD_DB_PATH=/data/workboard.db
COPY --from=build /app ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000 8787
# default command runs the web app; compose overrides this for the mcp service
CMD ["npm", "run", "start", "-w", "apps/web"]
