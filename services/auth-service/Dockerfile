# -----------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    cp -R node_modules /prod_modules && \
    npm ci

# -----------------------------------------------------------------
# Stage 2: Build
# -----------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma clients
RUN npx prisma generate --schema=prisma/platform/schema.prisma && \
    npx prisma generate --schema=prisma/tenant/schema.prisma

# Compile TypeScript
RUN npm run build

# -----------------------------------------------------------------
# Stage 3: Production runner
# -----------------------------------------------------------------
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# Production dependencies
COPY --from=deps /prod_modules ./node_modules

# Prisma generated clients
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Prisma CLI (needed for K8s migration Jobs)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Compiled code
COPY --from=builder /app/dist ./dist

# Prisma schemas (needed for migrations via K8s Jobs)
COPY --from=builder /app/prisma ./prisma

RUN chown -R nestjs:nodejs /app

USER nestjs

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/auth/v1/health || exit 1

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "dist/main.js"]
