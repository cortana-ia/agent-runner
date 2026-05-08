FROM node:22-slim

WORKDIR /app

# Install dependencies using npm (bypassing pnpm issues)
RUN npm install

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]