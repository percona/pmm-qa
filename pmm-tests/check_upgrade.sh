#!/bin/sh

#check for packages after upgrade
if [ $3 == "ami" ]; then
	rpm -qa | grep percona-qan-api2-$1
	rpm -qa | grep percona-dashboards-$1
	rpm -qa | grep pmm-update-$1
	rpm -qa | grep pmm-server-$1
	rpm -qa | grep pmm-managed-$1
	rpm -qa | grep pmm2-client-$1
	grafana-cli plugins ls | grep alexanderzobnin-zabbix-app
	grafana-cli plugins ls | grep "vertamedia-clickhouse-datasource @ 2.3.1"

	if [ $2 == "post" ]; then
		rpm -qa | grep dbaas-controller-$1
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
	if [ $2 == "post" ]; then
		docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep dbaas-controller-$1
		versions=(${DOCKER_VERSION//./ })
		export pmm_minor_v=$(echo ${versions[1]});
		if [[ $PERFORM_DOCKER_WAY_UPGRADE == "yes" && "${pmm_minor_v}" -gt "22" ]]; then
			docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ $PMM_SERVER_DOCKER_CONTAINER grafana-cli plugins ls | grep alexanderzobnin-zabbix-app
		fi
		if [[ $PERFORM_DOCKER_WAY_UPGRADE != "yes" ]]; then
			docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ $PMM_SERVER_DOCKER_CONTAINER grafana-cli plugins ls | grep alexanderzobnin-zabbix-app
		fi
		docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ $PMM_SERVER_DOCKER_CONTAINER grafana-cli plugins ls | grep "vertamedia-clickhouse-datasource @ 2.3.1"
	fi
fi
