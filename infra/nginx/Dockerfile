FROM nginx:latest

RUN rm /etc/nginx/nginx.conf
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY frontend/index.html /usr/share/nginx/html/

EXPOSE 80

CMD ["/bin/sh", "-c", "rm -f /var/log/nginx/access.log /var/log/nginx/error.log && exec nginx -g 'daemon off;'"]