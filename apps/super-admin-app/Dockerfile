# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml* ./
COPY pnpm-workspace.yaml ./

COPY packages/config/package.json ./packages/config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/ui-components/package.json ./packages/ui-components/
COPY apps/super-admin-app/package.json ./apps/super-admin-app/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

RUN pnpm --filter @forethread/config build 2>/dev/null || true
RUN pnpm --filter @forethread/shared-types build
RUN pnpm --filter @forethread/api-client build
RUN pnpm --filter @forethread/ui-components build
RUN pnpm --filter @forethread/super-admin-app build

# ─── Stage 3: runner (nginx) ──────────────────────────────────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/super-admin-app/dist /usr/share/nginx/html
COPY apps/super-admin-app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
