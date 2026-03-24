prep:
	docker --version
	docker-compose --version
#/opt/homebrew/var/www

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

