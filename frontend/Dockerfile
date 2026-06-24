FROM mirror.gcr.io/library/node:22-alpine AS build

WORKDIR /app

COPY frontend/package.json ./
COPY frontend/package-lock.json ./

RUN npm ci

COPY frontend/ ./

RUN npm run build

FROM mirror.gcr.io/library/nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5001
