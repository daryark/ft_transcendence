.PHONY: prep build up down clean fclean check

COMPOSE ?= docker-compose

prep:
	@docker --version
	@$(COMPOSE) --version


build:
	@$(COMPOSE) up -d --build

up:
	@$(COMPOSE) up -d

down:
	@$(COMPOSE) down -v

clean: down
	@docker system prune -a
	@sudo rm -rf ~/test_data/*

fclean:
	@docker stop $$(docker ps -qa)
	@docker system prune --all --force --volumes
	@docker network prune --force
	@docker volume prune --force
	@sudo rm -rf ~/test_data/*

re: down
	@$(COMPOSE) up -d --build

check:
	@echo "Checking API..."
	@curl -fsS http://localhost:3000/api/something
	@curl -fsS http://localhost:3000/api/users/7
	@echo "Checking database..."
	@$(COMPOSE) exec -T database pg_isready -U myuser -d mydatabase
	
#docker exec -it 7ef22cde1b09 psql -U myuser -d mydatabase -c "SELECT * FROM users;"