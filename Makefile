COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || (command -v docker-compose >/dev/null 2>&1 && echo docker-compose || echo "docker compose"))

prep:
	@docker --version
	@$(COMPOSE) --version


build:
	@$(COMPOSE) up -d --build
	@docker run --rm -v trans_es-snapshots:/snap alpine chown -R 1000:1000 /snap

dev-build:
	@$(COMPOSE) -f docker-compose.dev.yml up -d --build

up:
	@$(COMPOSE) up -d

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
	@$(COMPOSE) up -d --build

check:
	echo "Checking API..."
	curl http://localhost:3000/api/something
	curl http://localhost:3000/api/users/7
	echo "Checking database..."
	curl http://localhost:5432/

ilm-check:
	curl -X PUT "http://localhost:9200/_ilm/policy/test-delete-policy" -H "Content-Type: application/json" -d '{"policy": {"phases": {"hot": { "min_age": "0ms", "actions": {} }, "delete": { "min_age": "1m", "actions": { "delete": {} }}}}}'
	curl -X PUT "http://localhost:9200/test-logs-001" -H "Content-Type: application/json" -d '{"settings": {"index.lifecycle.name": "test-delete-policy"}}'
	curl -s "http://localhost:9200/_cat/indices/test-logs-*?v"
	curl -s "http://localhost:9200/test-logs-001/_ilm/explain?pretty"
	echo "Now wait for 10 mins and check again..."

slm-check:
	curl -k https://localhost
	curl -k https://localhost
	curl -sS -X POST "http://localhost:9200/_slm/policy/daily-nginx-logs/_execute"
	curl -sS -X POST "http://localhost:9200/_slm/policy/daily-nginx-logs/_execute"
	curl -sS -X POST "http://localhost:9200/_slm/policy/daily-nginx-logs/_execute"
	curl -sS -X POST "http://localhost:9200/_slm/policy/daily-nginx-logs/_execute"
	sleep 120
	curl -s "http://localhost:9200/_cat/snapshots/trans_archive?v"
	curl -s "http://localhost:9200/_slm/stats?pretty"

show-policies:
	curl -s "http://localhost:9200/_slm/policy/daily-nginx-logs?pretty"
	curl -s "http://localhost:9200/_snapshot/trans_archive?pretty"
	curl -s "http://localhost:9200/_cat/snapshots/trans_archive?v"
	curl -s "http://localhost:9200/_ilm/policy/nginx-logs-policy?pretty" 
	curl -s "http://localhost:9200/_cat/indices/nginx-logs-*?v"

cert:
	curl -s https://api.github.com/repos/FiloSottile/mkcert/releases/latest | grep browser_download_url  | grep linux-amd64 | cut -d '"' -f 4 | wget -qi -
	mv mkcert-v*-linux-amd64 mkcert
	chmod a+x mkcert
	sudo mv mkcert /usr/local/bin/
	cd tools/
	mkcert ft-transcendence.42.fr
	
#docker exec -it 7ef22cde1b09 psql -U myuser -d mydatabase -c "SELECT * FROM users;"
.PHONY: prep build up down clean fclean re check cert