prep:
	docker --version
	docker-compose --version


build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

check:
	echo "Checking API..."
	curl http://localhost:3000/api/something
	curl http://localhost:3000/api/users/7
	echo "Checking database..."
	curl http://localhost:5432/
	
#docker exec -it 7ef22cde1b09 psql -U myuser -d mydatabase -c "SELECT * FROM users;"
	



