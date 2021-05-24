#!/bin/sh

#check for packages after upgrade
if [ $3 == "ami" ]; then
	rpm -qa | grep percona-qan-api2-$1
	rpm -qa | grep percona-dashboards-$1
	rpm -qa | grep pmm-update-$1
	rpm -qa | grep pmm-server-$1
	rpm -qa | grep pmm-managed-$1
	rpm -qa | grep pmm2-client-$1
	ls -la /var/lib/grafana/plugins/ | grep alexanderzobnin-zabbix-app

	if [ $2 == "post" ]; then
		rpm -qa | grep dbaas-controller-$1
	fi
else
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep percona-qan-api2-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep percona-dashboards-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm-update-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm-server-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm-managed-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm2-client-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER ls -la /var/lib/grafana/plugins/ | grep alexanderzobnin-zabbix-app

	if [ $2 == "post" ]; then
		docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep dbaas-controller-$1
	fi
fi