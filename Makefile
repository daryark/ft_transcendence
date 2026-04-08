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

cert:
	curl -s https://api.github.com/repos/FiloSottile/mkcert/releases/latest | grep browser_download_url  | grep linux-amd64 | cut -d '"' -f 4 | wget -qi -
	mv mkcert-v*-linux-amd64 mkcert
	chmod a+x mkcert
	sudo mv mkcert /usr/local/bin/
	cd tools/
	mkcert ft-transcendence.42.fr
	
#docker exec -it 7ef22cde1b09 psql -U myuser -d mydatabase -c "SELECT * FROM users;"
	



