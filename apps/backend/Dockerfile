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

# Preserve the workspace layout at runtime. The @nestjs/swagger CLI plugin
# inlines relative `require(...)` calls for DTO types whose source lives in a
# workspace package (e.g. @forethread/shared-types). Those relative paths are
# computed from apps/backend/src up to the workspace root and back into
# packages/shared-types/dist, so the runtime tree has to mirror that layout
# or the requires overflow past `/` and fail to resolve.
WORKDIR /app/apps/backend

ENV NODE_ENV=production

# Copy the full deployed bundle (includes dist, node_modules, prisma files)
# into the workspace-relative apps/backend location.
COPY --from=builder /app/deploy ./

# Place workspace packages at their workspace-relative locations so the
# swagger-plugin-emitted relative requires (../../../../../packages/...)
# resolve from apps/backend/dist/modules/<X>/.
#
# The plugin's TS-resolution path can land on either ".../src/<dto>" (when
# it resolves via package.json `types: ./src/index.ts`) or ".../dist/<dto>"
# (when it sees `dist/index.d.ts` co-located with `main`), depending on
# whether shared-types/dist exists at backend-compile time. We can't
# reliably predict which it will emit per build, so we stage the built
# dist JS at *both* locations — same files, two reachable paths.
COPY --from=builder /app/packages/shared-types/dist /app/packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/dist /app/packages/shared-types/src

# Make shared-types' transitive deps (class-validator, class-transformer, etc.)
# resolvable from inside the shared-types files via Node's parent-node_modules
# lookup. The pnpm-deployed flat node_modules lives under apps/backend; symlink
# it into the shared-types tree so a require('class-validator') from
# /app/packages/shared-types/dist/... walks up and finds it.
RUN ln -s /app/apps/backend/node_modules /app/packages/shared-types/node_modules

# Copy entrypoint script (from build context, not builder)
COPY apps/backend/docker-entrypoint.sh /app/apps/backend/docker-entrypoint.sh
RUN chmod +x /app/apps/backend/docker-entrypoint.sh

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/v1/health || exit 1

ENTRYPOINT ["/app/apps/backend/docker-entrypoint.sh"]
CMD ["start"]
