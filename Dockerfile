FROM node:22-alpine

WORKDIR /app

# Install dependencies - ignoring scripts for now
RUN corepack enable pnpm && pnpm install

# Copy source
COPY . .

# Generate Prisma
RUN pnpm exec prisma generate || true

# Build
RUN pnpm build || npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]