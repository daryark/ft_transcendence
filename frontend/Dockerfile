FROM node:20-alpine

WORKDIR /app

COPY frontend/package.json ./
COPY frontend/package-lock.json ./

# Vite is a devDependency; needed for `npm run dev` in this image.
RUN npm install

COPY frontend/ ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
