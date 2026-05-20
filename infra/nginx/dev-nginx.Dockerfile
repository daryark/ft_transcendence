FROM nginx:latest


RUN rm /etc/nginx/nginx.conf
COPY infra/nginx/dev-nginx.conf /etc/nginx/nginx.conf
COPY frontend/index.html /usr/share/nginx/html/

EXPOSE 80