FROM nginx:latest

RUN unlink /var/log/nginx/access.log && unlink /var/log/nginx/error.log 
RUN rm /etc/nginx/nginx.conf
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY frontend/index.html /usr/share/nginx/html/

EXPOSE 80