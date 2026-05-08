# ─── Stage 1 : dépendances production ────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# ─── Stage 2 : génération Prisma client ───────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate

# ─── Stage 3 : image finale légère ───────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Dépendances prod
COPY --from=deps /app/node_modules ./node_modules

# Client Prisma généré
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Code source
COPY src ./src
COPY prisma ./prisma
COPY package.json ./

EXPOSE 3000

# Migrations automatiques au démarrage puis lancement du serveur
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
