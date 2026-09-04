#!/bin/bash -e

docker exec -it pmm-server pmm-admin remove valkey valkey-primary-svc || :
docker exec -it pmm-server pmm-admin remove valkey valkey-replica1-svc || :
docker exec -it pmm-server pmm-admin remove valkey valkey-replica2-svc || :
docker exec -it pmm-server pmm-admin remove valkey sentinel1-svc || :
docker exec -it pmm-server pmm-admin remove valkey sentinel2-svc || :
docker exec -it pmm-server pmm-admin remove valkey sentinel3-svc || :

docker rm -vf valkey-primary valkey-replica-1 valkey-replica-2 || :
docker rm -vf sentinel-1 sentinel-2 sentinel-3 || :

docker volume rm -f valkey-primary-data valkey-replica-1-data valkey-replica-2-data || :

rm -rf "$HOME/valkey"
