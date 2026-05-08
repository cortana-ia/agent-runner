FROM node:22-alpine

WORKDIR /app

# Copy package files first
COPY package.json pnpm-lock.yaml ./

# Enable pnpm and approve builds
RUN corepack enable pnpm && \
    pnpm config set ignore-scripts false && \
    pnpm approve-builds --global @nestjs/core @prisma/client @prisma/engines msgpackr-extract prisma

# Install dependencies
RUN pnpm install

# Copy rest of source
COPY . .

# Generate Prisma
RUN pnpm exec prisma generate

# Build
RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/main.js"]