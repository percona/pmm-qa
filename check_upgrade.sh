#!/bin/sh

#check for packages after upgrade
docker exec $1 rpm -qa | grep percona-qan-app-$2
docker exec $1 rpm -qa | grep percona-qan-api2-$2
docker exec $1 rpm -qa | grep percona-dashboards-$2
docker exec $1 rpm -qa | grep pmm-update-$2
docker exec $1 rpm -qa | grep pmm-server-$2
docker exec $1 rpm -qa | grep pmm-managed-$2
docker exec $1 rpm -qa | grep pmm2-client-$2