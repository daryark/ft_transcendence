FROM node:20-alpine

WORKDIR /app

# Prisma generate needs DATABASE_URL at build-time; runtime values still come from docker-compose env_file.
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}

COPY backend/package.json ./
RUN npm install --omit=dev
RUN npm install tsx bcrypt zod prisma@6.19.3 @prisma/client@6.19.3 dotenv dotenv-expand @prisma/adapter-pg@6.19.3 pg
COPY backend ./
RUN npx prisma generate

EXPOSE 3000

CMD ["npx", "tsx", "server/index.js"]
