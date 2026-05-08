FROM node:22-alpine AS builder

WORKDIR /app

# Configurar pnpm para permitir build scripts
RUN corepack enable pnpm && \
    pnpm config set ignore-scripts false --location project

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY . .
RUN pnpm exec prisma generate
RUN pnpm build

FROM node:22-alpine

WORKDIR /app

# Configurar pnpm para permitir build scripts
RUN corepack enable pnpm && \
    pnpm config set ignore-scripts false --location project

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY .env.example .env

EXPOSE 3000

CMD ["node", "dist/main.js"]