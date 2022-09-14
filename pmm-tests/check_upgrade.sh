#!/bin/sh

declare PREPOST_UPGRADE DISTRIBUTION
export PREPOST_UPGRADE=afterUpgrade
export DISTRIBUTION=docker

while [ $# -gt 0 ]; do
  case "$1" in
    --pmm-version=*)
      export PMM_VERSION="${1#*=}"
      ;;
    --prepost-upgrade=*)
      export PREPOST_UPGRADE="${1#*=}"
      ;;
    --distribution=*)
      export DISTRIBUTION="${1#*=}"
      ;;
    *)
      printf "***************************\n"
      printf "Invalid Argument Passed, usage of this script:\n"
      echo "--pmm-version=2.30.0              Pass PMM Version, this field is required, no defaults"
      echo "--prepost-upgrade=afterUpgrade    Pass the stage if this is a Pre upgrade verification or After Upgrade verification"
      echo "--distribution=docker             Pass the value if this is a docker based PMM Server or AMI/OVF based PMM Server (pass value AMI for both AMI & OVF)"
      printf "***************************\n"
      exit 1
  esac
  shift
done


#check for packages after upgrade
if [ "$DISTRIBUTION" == "ami" ]; then
	rpm -qa | grep percona-qan-api2-$PMM_VERSION
	rpm -qa | grep percona-dashboards-$PMM_VERSION
	if [ "${SERVER_VERSION}" != "2.25.0" ]; then
		rpm -qa | grep pmm-update-$PMM_VERSION
	fi
	rpm -qa | grep pmm-managed-$PMM_VERSION
	rpm -qa | grep pmm2-client-$PMM_VERSION
	sudo supervisorctl status | grep qan-api2 | grep RUNNING
	sudo supervisorctl status | grep alertmanager | grep RUNNING
	sudo supervisorctl status | grep clickhouse | grep RUNNING
	sudo supervisorctl status | grep grafana | grep RUNNING
	sudo supervisorctl status | grep nginx | grep RUNNING
	sudo supervisorctl status | grep pmm-agent | grep RUNNING
	sudo supervisorctl status | grep pmm-managed | grep RUNNING
	sudo supervisorctl status | grep postgresql | grep RUNNING

	if [ "$PREPOST_UPGRADE" == "afterUpgrade" ]; then
		rpm -qa | grep dbaas-controller-$PMM_VERSION
		rpm -qa | grep pmm-dump-$PMM_VERSION
		sudo supervisorctl status | grep victoriametrics | grep RUNNING
		sudo supervisorctl status | grep vmalert | grep RUNNING
		grafana-cli plugins ls | grep "vertamedia-clickhouse-datasource @ 2.4.4"
		grafana-cli plugins ls | grep alexanderzobnin-zabbix-app
		sudo victoriametrics --version | grep pmm-6401-v1.77.1
	fi
else
	export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
	echo $PMM_SERVER_DOCKER_CONTAINER
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep percona-qan-api2-$PMM_VERSION
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep percona-dashboards-$PMM_VERSION
	if [ "$PMM_VERSION" != "2.25.0" ]; then
		docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm-update-$PMM_VERSION
	fi
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm-managed-$PMM_VERSION
	docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm2-client-$PMM_VERSION
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep qan-api2 | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep alertmanager | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep clickhouse | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep grafana | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep nginx | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep pmm-agent | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep pmm-managed | grep RUNNING
	docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep postgresql | grep RUNNING
	if [ "$PREPOST_UPGRADE" == "afterUpgrade" ]; then
		docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep dbaas-controller-$PMM_VERSION
		docker exec $PMM_SERVER_DOCKER_CONTAINER rpm -qa | grep pmm-dump-$PMM_VERSION
		docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep victoriametrics | grep RUNNING
		docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl status | grep vmalert | grep RUNNING
		docker exec $PMM_SERVER_DOCKER_CONTAINER victoriametrics --version | grep pmm-6401-v1.77.1
		versions=(${DOCKER_VERSION//./ })
		export pmm_minor_v=$(echo ${versions[1]});
		if [[ "$PERFORM_DOCKER_WAY_UPGRADE" == "yes" && "${pmm_minor_v}" -gt "22" ]] || [[ "$PERFORM_DOCKER_WAY_UPGRADE" != "yes" ]]; then
			docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ $PMM_SERVER_DOCKER_CONTAINER grafana-cli plugins ls | grep alexanderzobnin-zabbix-app
		fi
		docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ $PMM_SERVER_DOCKER_CONTAINER grafana-cli plugins ls | grep "vertamedia-clickhouse-datasource @ 2.4.4"
	fi
fi
