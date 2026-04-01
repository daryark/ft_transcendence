FROM postgres:16.3 

# Set environment variables for the default user, password, and database
ENV POSTGRES_USER=myuser
ENV POSTGRES_PASSWORD=mypassword
ENV POSTGRES_DB=mydatabase

COPY backend/database/init.sql /docker-entrypoint-initdb.d/