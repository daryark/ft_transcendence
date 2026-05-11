FROM node:20-alpine

WORKDIR /app

COPY backend/package.json ./
RUN npm install --omit=dev
RUN npm install tsx bcrypt zod prisma@6.19.3 @prisma/client@6.19.3 dotenv dotenv-expand @prisma/adapter-pg@6.19.3 pg
COPY backend ./
RUN npx prisma generate

EXPOSE 3000

CMD ["npx", "tsx", "server/index.js"]
