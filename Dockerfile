# One image serves both compose services. Bun installs workspace dependencies and
# starts scripts; Node 22 remains the JavaScript runtime — see docker-compose.yml.
FROM oven/bun:1.4.2-debian AS bun
FROM node:22-bookworm-slim AS deps
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
# No native modules anywhere in the tree: the old SQLite board is read through
# Node's built-in node:sqlite, so no build toolchain is needed.
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/mcp/package.json packages/mcp/
RUN bun install --frozen-lockfile

FROM deps AS build
# source over the dependency tree (.dockerignore keeps local node_modules/.next/data out)
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run --filter @workboard/web build

FROM node:22-bookworm-slim AS runtime
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    WORKBOARD_DATA_DIR=/data/workboard
COPY --from=build /app ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000 8787
# default command runs the web app; compose overrides this for the mcp service
CMD ["bun", "run", "--filter", "@workboard/web", "start"]
