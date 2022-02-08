#!/bin/sh

#check for packages after upgrade
if [ $3 == "ami" ]; then
	rpm -qa | grep percona-qan-api2-$1
	rpm -qa | grep percona-dashboards-$1
	rpm -qa | grep pmm-update-$1
	rpm -qa | grep pmm-server-$1
	rpm -qa | grep pmm-managed-$1
	rpm -qa | grep pmm2-client-$1

	if [ $2 == "post" ]; then
		rpm -qa | grep dbaas-controller-$1
		grafana-cli plugins ls | grep "vertamedia-clickhouse-datasource @ 2.3.1"
		grafana-cli plugins ls | grep alexanderzobnin-zabbix-app
	fi
else
	export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
	echo $PMM_SERVER_DOCKER_CONTAINER
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep percona-qan-api2-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep percona-dashboards-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm-update-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm-server-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm-managed-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm2-client-$1
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep qan-api2 | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep alertmanager | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep clickhouse | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep cron | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep grafana | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep nginx | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep pmm-agent | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep pmm-managed | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep postgresql | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep victoriametrics | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep vmalert | grep RUNNING
	if [ $2 == "post" ]; then
		docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep dbaas-controller-$1
		versions=(${DOCKER_VERSION//./ })
		export pmm_minor_v=$(echo ${versions[1]});
		if [[ $PERFORM_DOCKER_WAY_UPGRADE == "yes" && "${pmm_minor_v}" -gt "22" ]] || [[ $PERFORM_DOCKER_WAY_UPGRADE != "yes" ]]; then
			docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ $PMM_SERVER_DOCKER_CONTAINER grafana-cli plugins ls | grep alexanderzobnin-zabbix-app
		fi
		docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ $PMM_SERVER_DOCKER_CONTAINER grafana-cli plugins ls | grep "vertamedia-clickhouse-datasource @ 2.3.1"
	fi
fi
