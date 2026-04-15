FROM node:20-alpine

WORKDIR /app

COPY backend/package.json ./
RUN npm install --omit=dev

COPY backend/server ./server

EXPOSE 3000

CMD ["node", "server/index.js"]
