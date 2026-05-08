FROM node:22-alpine

WORKDIR /app

# Instalar dependencias usando npm (más compatible)
COPY package.json package-lock.json ./
RUN npm install

# Copiar solo lo necesario
COPY . .

# Generar Prisma
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]