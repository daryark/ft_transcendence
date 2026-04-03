FROM node:20-alpine

WORKDIR /app

COPY frontend/package.json ./
RUN npm install --omit=dev

COPY frontend/ ./

EXPOSE 5173

CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "5173"]
