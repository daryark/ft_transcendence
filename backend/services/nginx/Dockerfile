FROM debian:latest

RUN apt-get update && apt-get install -y ngnix openssl
RUN rm /etc/nginx/nginx.conf
COPY ./nginx.conf /etc/nginx/