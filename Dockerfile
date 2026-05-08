FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm config set ignore-scripts false && pnpm install

COPY . .
RUN corepack enable pnpm && pnpm exec prisma generate
RUN corepack enable pnpm && pnpm build

FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm config set ignore-scripts false && pnpm install --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY .env.example .env

EXPOSE 3000

CMD ["node", "dist/main.js"]