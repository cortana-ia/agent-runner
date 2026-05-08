FROM node:22-alpine

WORKDIR /app

# Copy package files first
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN corepack enable pnpm && pnpm install

# Copy rest of source
COPY . .

# Generate Prisma (ignore errors)
RUN pnpm exec prisma generate || true

# Build (ignore errors)
RUN pnpm build || npm run build || true

EXPOSE 3000

CMD ["node", "dist/main.js"]