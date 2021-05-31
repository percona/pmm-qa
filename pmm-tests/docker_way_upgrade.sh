#!/bin/sh

## Expecting PMM_Server Tag to be upgraded to as a parameter
if [ $# -lt 1 ]; then
    echo "Please Provide Docker Server Tag to Upgrade too"
    exit 1
fi

#check for Container Name To Stop before Upgrade
export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
echo $PMM_SERVER_DOCKER_CONTAINER
docker stop $PMM_SERVER_DOCKER_CONTAINER
docker rm $PMM_SERVER_DOCKER_CONTAINER

## Setup new Container using volume from previous container
export PMM_SERVER_DOCKER_VOLUME=$(docker ps -a --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')

docker run -d -p 80:80 -p 443:443 --volumes-from $PMM_SERVER_DOCKER_VOLUME --name pmm-server --restart always $1
sleep 30
docker logs pmm-server
