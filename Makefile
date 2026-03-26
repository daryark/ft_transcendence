prep:
	docker --version
	docker-compose --version


build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

