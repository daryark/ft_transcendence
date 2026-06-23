ifneq (,$(wildcard .env))
include .env
export
endif

COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || (command -v docker-compose >/dev/null 2>&1 && echo docker-compose || echo "docker compose"))
NGINX_HTTP_PORT ?= 8080
NGINX_HTTPS_PORT ?= 443
HOST_IP ?=
ES_AUTH := elastic:$(ELASTIC_PASSWORD)
ES_CURL = docker exec elasticsearch curl -s -u '$(ES_AUTH)'

PRINT_HTTPS_URL = https://10.64.249.107/
# define PRINT_HTTPS_URL
# 	@host_ip="$${HOST_IP:-$$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($$i == "src") {print $$(i+1); exit}}')}"; \
# 	host_ip="$${host_ip:-$$(hostname -I 2>/dev/null | awk '{print $$1}')}"; \
# 	if [ -z "$$host_ip" ]; then echo "Could not detect local IP. Run: HOST_IP=<ip> make $@"; exit 1; fi; \
# 	echo "Open: https://$$host_ip"
# endef

define PRINT_HTTP_URL
	@host_ip="$${HOST_IP:-$$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($$i == "src") {print $$(i+1); exit}}')}"; \
	host_ip="$${host_ip:-$$(hostname -I 2>/dev/null | awk '{print $$1}')}"; \
	if [ -z "$$host_ip" ]; then echo "Could not detect local IP. Run: HOST_IP=<ip> make $@"; exit 1; fi; \
	echo "Open: http://$$host_ip:$(NGINX_HTTP_PORT)"
endef


prep:
	@docker --version
	@$(COMPOSE) --version


build:
	@NGINX_HTTPS_PORT=$(NGINX_HTTPS_PORT) $(COMPOSE) up -d --build
	@docker run --rm -v trans_es-snapshots:/snap alpine chown -R 1000:1000 /snap
	$(PRINT_HTTPS_URL)

dev-build:
	@NGINX_HTTP_PORT=$(NGINX_HTTP_PORT) $(COMPOSE) -f docker-compose.dev.yml up -d --build
	$(PRINT_HTTP_URL)

up:
	@NGINX_HTTPS_PORT=$(NGINX_HTTPS_PORT) $(COMPOSE) up -d
	$(PRINT_HTTPS_URL)

down:
	@$(COMPOSE) down -v

clean: down
	@docker system prune -a

fclean:
	@docker stop $$(docker ps -qa)
	@docker system prune --all --force --volumes
	@docker network prune --force
	@docker volume prune --force
	@docker volume rm trans_nginx-logs trans_esdata trans_es-snapshots trans_grafana_data trans_prometheus_data

re: down
	@NGINX_HTTPS_PORT=$(NGINX_HTTPS_PORT) $(COMPOSE) up -d --build
	$(PRINT_HTTPS_URL)

check:
	echo "Checking API..."
	curl http://localhost:3000/api/something
	curl http://localhost:3000/api/users/7
	echo "Checking database..."
	curl http://localhost:5432/

ilm-check:
	$(ES_CURL) -X PUT "http://localhost:9200/_ilm/policy/test-delete-policy" -H "Content-Type: application/json" -d '{"policy": {"phases": {"hot": { "min_age": "0ms", "actions": {} }, "delete": { "min_age": "1m", "actions": { "delete": {} }}}}}'
	$(ES_CURL) -X PUT "http://localhost:9200/test-logs-001" -H "Content-Type: application/json" -d '{"settings": {"index.lifecycle.name": "test-delete-policy"}}'
	$(ES_CURL) -s "http://localhost:9200/_cat/indices/test-logs-*?v"
	$(ES_CURL) -s "http://localhost:9200/test-logs-001/_ilm/explain?pretty"
	echo "Now wait for 10 mins and check again..."

slm-check:
	curl -k https://localhost
	curl -k https://localhost
	$(ES_CURL) -sS -X POST "http://localhost:9200/_slm/policy/daily-nginx-logs/_execute"
	$(ES_CURL) -sS -X POST "http://localhost:9200/_slm/policy/daily-nginx-logs/_execute"
	$(ES_CURL) -sS -X POST "http://localhost:9200/_slm/policy/daily-nginx-logs/_execute"
	$(ES_CURL) -sS -X POST "http://localhost:9200/_slm/policy/daily-nginx-logs/_execute"
	sleep 120
	$(ES_CURL) -s "http://localhost:9200/_cat/snapshots/trans_archive?v"
	$(ES_CURL) -s "http://localhost:9200/_slm/stats?pretty"

show-policies:
	$(ES_CURL) 'http://localhost:9200/_slm/policy/daily-nginx-logs?pretty'
	$(ES_CURL) 'http://localhost:9200/_snapshot/trans_archive?pretty'
	$(ES_CURL) 'http://localhost:9200/_cat/snapshots/trans_archive?v'
	$(ES_CURL) 'http://localhost:9200/_ilm/policy/nginx-logs-policy?pretty'
	$(ES_CURL) 'http://localhost:9200/_cat/indices/nginx-logs-*?v'

cert:
	curl -s https://api.github.com/repos/FiloSottile/mkcert/releases/latest | grep browser_download_url  | grep linux-amd64 | cut -d '"' -f 4 | wget -qi -
	mv mkcert-v*-linux-amd64 mkcert
	chmod a+x mkcert
	sudo mv mkcert /usr/local/bin/
	cd tools/
	mkcert ft-transcendence.42.fr

#docker exec -it 7ef22cde1b09 psql -U myuser -d mydatabase -c "SELECT * FROM users;"
.PHONY: prep build dev-build up down clean fclean re check cert
