FROM node:22-alpine

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable pnpm

# Allow build scripts globally
RUN pnpm config set ignore-scripts false --global

# Install dependencies (ignoring postinstall for now)
RUN pnpm install --ignore-scripts

# Copy source
COPY . .

# Generate Prisma client manually
RUN pnpm exec prisma generate

# Build
RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/main.js"]