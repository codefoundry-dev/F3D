# ── Build stage ──────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @forethread/vendor-app build

# ── Serve stage ──────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=build /app/apps/vendor-app/dist /usr/share/nginx/html

# SPA fallback
RUN echo 'server { listen 80; root /usr/share/nginx/html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
