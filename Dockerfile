FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/oracle-brain/package.json packages/oracle-brain/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages/oracle-brain packages/oracle-brain
RUN pnpm --filter @x402orcle/web build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --home-dir /app nextjs

WORKDIR /app
COPY --from=build --chown=nextjs:nodejs /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=nextjs:nodejs /app/node_modules node_modules
COPY --from=build --chown=nextjs:nodejs /app/apps/web apps/web
COPY --from=build --chown=nextjs:nodejs /app/packages/oracle-brain packages/oracle-brain

USER nextjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3001/api/health').then(response=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web", "-p", "3001"]
