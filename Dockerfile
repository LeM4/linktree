# syntax=docker/dockerfile:1

ARG BUN_VERSION=1

# ---- build: install all deps, build CSS and vendor assets -------------------------
FROM oven/bun:${BUN_VERSION} AS build
WORKDIR /usr/src/app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ---- runtime: production deps + app code only ------------------------------------
FROM oven/bun:${BUN_VERSION}-slim AS runtime

ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="linktree" \
      org.opencontainers.image.description="Lightweight self-hosted Linktree clone with geo-blocking and analytics" \
      org.opencontainers.image.licenses="ISC" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    ADMIN_PORT=3001 \
    DATA_DIR=/usr/src/app/db \
    TZ=UTC

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production && rm -rf /root/.bun/install/cache

COPY --from=build /usr/src/app/public ./public
COPY lib ./lib
COPY routes ./routes
COPY views ./views
COPY themes ./themes
COPY main.js server.js admin-server.js cli.js ./
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p "$DATA_DIR" && chown -R bun:bun "$DATA_DIR"
VOLUME ["/usr/src/app/db"]
EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD bun -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "main.js"]
