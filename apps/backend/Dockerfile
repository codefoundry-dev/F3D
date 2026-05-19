# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace root manifests and all packages
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# Install all dependencies (including dev for building)
RUN pnpm install --frozen-lockfile --filter @forethread/backend...

# Build shared-types (backend depends on it)
RUN pnpm --filter @forethread/shared-types build

# Generate Prisma client
RUN pnpm --filter @forethread/backend db:generate

# Build the NestJS application
RUN pnpm --filter @forethread/backend build

# Compile seed.ts → seed.js for production (no ts-node needed at runtime)
RUN cd apps/backend && node -e " \
  const ts = require('typescript'); \
  const fs = require('fs'); \
  const src = fs.readFileSync('prisma/seed.ts', 'utf8'); \
  const result = ts.transpileModule(src, { \
    compilerOptions: { \
      module: ts.ModuleKind.CommonJS, \
      target: ts.ScriptTarget.ES2020, \
      esModuleInterop: true, \
      strict: true \
    } \
  }); \
  fs.writeFileSync('prisma/seed.js', result.outputText); \
  console.log('seed.ts compiled to seed.js'); \
"

# Create standalone deployment with flat node_modules (resolves pnpm symlinks)
RUN pnpm --filter @forethread/backend deploy --prod /app/deploy

# Copy Prisma generated client into deployed node_modules
# The generated client lives in the pnpm virtual store, not in apps/backend/node_modules
RUN mkdir -p /app/deploy/node_modules/.prisma && \
    cp -r /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client /app/deploy/node_modules/.prisma/client

# Copy built workspace packages (pnpm deploy doesn't include their dist/)
RUN cp -r /app/packages/shared-types/dist /app/deploy/node_modules/@forethread/shared-types/dist
RUN cp -r /app/packages/i18n/src /app/deploy/node_modules/@forethread/i18n/src

# =============================================================================
# Stage 2: Runner (production image)
# =============================================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init openssl

WORKDIR /app

ENV NODE_ENV=production

# Copy the full deployed bundle (includes dist, node_modules, prisma files)
COPY --from=builder /app/deploy ./

# Copy entrypoint script (from build context, not builder)
COPY apps/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/v1/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["start"]
