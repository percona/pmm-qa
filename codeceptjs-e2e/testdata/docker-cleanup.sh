#!/usr/bin/env bash

docker image prune -af
docker container prune -f
docker volume prune -f
docker system prune -f