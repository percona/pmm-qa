#!/bin/bash
set -xe

echo
echo "Configuring Multiple Docker Images with PMM Server and Client"
echo "Please wait...."
docker network create docker-client-check || true
docker compose -f docker-compose-clients.yaml down -v --remove-orphans
docker compose -f docker-compose-clients.yaml build --no-cache
CLIENT_DOCKER_VERSION=$CLIENT_DOCKER_VERSION docker compose -f docker-compose-clients.yaml up -d
sleep 20
echo "Adding DB Clients to PMM Server"
docker exec pmm-client-1 pmm-admin add mysql --username=pmm --password=pmm-pass --service-name=ps-8.0 --query-source=perfschema --host=ps-1 --port=3306 --server-url=https://admin:admin@pmm-server-1:8443 --server-insecure-tls=true
docker exec pmm-client-1 pmm-admin add postgresql --query-source=pgstatements --username=pmm --password=pmm-pass --service-name=pdpgsql-1 --host=pdpgsql-1 --port=5432 --server-url=https://admin:admin@pmm-server-1:8443 --server-insecure-tls=true
docker exec pmm-client-1 pmm-admin add mongodb --username=pmm --password=pmm-pass --service-name=mongodb-7.0  --host=psmdb-1 --port=27017 --server-url=https://admin:admin@pmm-server-1:8443 --server-insecure-tls=true
