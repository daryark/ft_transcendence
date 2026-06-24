FROM mirror.gcr.io/library/node:20-alpine

WORKDIR /app

# Prisma generate needs DATABASE_URL at build-time; runtime values still come from docker-compose env_file.
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}

COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev
RUN npm install tsx bcrypt prom-client zod prisma@6.19.3 @prisma/client@6.19.3 dotenv dotenv-expand @prisma/adapter-pg@6.19.3 pg
COPY backend ./
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
