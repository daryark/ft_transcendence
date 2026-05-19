COMPOSE ?= docker-compose

prep:
	@docker --version
	@$(COMPOSE) --version


build:
	@$(COMPOSE) up -d --build
	@echo "Waiting for Kibana..."
 	@until curl -s -o /dev/null http://localhost:5601/api/status; do sleep 5; done
 	@echo "Kibana is ready. Importing dashboard..."
 	@curl -X POST "http://localhost:5601/api/saved_objects/_import?overwrite=true" \
		-H "kbn-xsrf: true" \
		--form file=@infra/elk/kibana/dashboard.ndjson
 	@echo "\nDashboard imported."

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
	@docker volume rm trans_nginx-logs

re: down
	@$(COMPOSE) up -d --build

check:
	echo "Checking API..."
	curl http://localhost:3000/api/something
	curl http://localhost:3000/api/users/7
	echo "Checking database..."
	curl http://localhost:5432/

cert:
	curl -s https://api.github.com/repos/FiloSottile/mkcert/releases/latest | grep browser_download_url  | grep linux-amd64 | cut -d '"' -f 4 | wget -qi -
	mv mkcert-v*-linux-amd64 mkcert
	chmod a+x mkcert
	sudo mv mkcert /usr/local/bin/
	cd tools/
	mkcert ft-transcendence.42.fr
	
#docker exec -it 7ef22cde1b09 psql -U myuser -d mydatabase -c "SELECT * FROM users;"
.PHONY: prep build up down clean fclean re check cert