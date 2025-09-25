#! /bin/bash


while [ $# -gt 0 ]; do

   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi

  shift
done



if [ -z "$mysql_version" ]
then
      export mysql_version=latest
fi


if [ -z "$mongodb_version" ]
then
      export mongodb_version=latest
fi


if [ -z "$postgres_version" ]
then
      export postgres_version=latest
fi

    export mysql_container_name=mysql
    export mongodb_container_name=mongodb
    export postgres_container_name=postgres
    export pmm_server_container_name=pmm-server
    export pmm_client_container_name=pmm-client


setup_mysql() {
	docker pull mysql:${mysql_version}
	docker stop ${mysql_container_name} || true
	docker rm ${mysql_container_name} || true
	echo "Starting Mysql Container"
	docker run --name ${mysql_container_name} -p 3306:3306 -e MYSQL_ROOT_PASSWORD=my-secret-pw -d mysql:${mysql_version}
	sleep 60
	docker exec ${mysql_container_name} ${mysql_container_name} -u root -pmy-secret-pw -e "DROP DATABASE IF EXISTS sbtest;"
 	docker exec ${mysql_container_name} ${mysql_container_name} -u root -pmy-secret-pw -e "CREATE SCHEMA sbtest;"
    sleep 10
    docker exec ${mysql_container_name} ${mysql_container_name} -u root -pmy-secret-pw -e "DROP USER IF EXISTS sbtest1;" 
 	docker exec ${mysql_container_name} ${mysql_container_name} -u root -pmy-secret-pw -e "Create user sbtest1 identified by 'testing1';"
    sleep 10
    docker exec ${mysql_container_name} ${mysql_container_name} -u root -pmy-secret-pw -e "GRANT ALL PRIVILEGES ON sbtest.* to sbtest1;"
    sleep 10
    docker exec ${mysql_container_name} ${mysql_container_name} -u root -pmy-secret-pw -e "ALTER USER 'sbtest1'@'%' IDENTIFIED WITH mysql_native_password BY 'testing1';"
    sleep 10
}

setup_mongodb() {
	docker pull mongo:${mongodb_version}
 	docker stop ${mongodb_container_name} || true
	docker rm ${mongodb_container_name} || true
	echo "Starting Mongodb container"
	docker run --name ${mongodb_container_name} -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=mysecretpassword -d mongo:${mongodb_version}
	sleep 15
}

setup_postgres() {
	docker pull postgres:${postgres_version}
	docker stop ${postgres_container_name} || true
	docker rm ${postgres_container_name} || true
	echo "Starting postgres container"
	docker run --name ${postgres_container_name} -p 5432:5432 -e POSTGRES_PASSWORD=mysecretpassword -d postgres:${postgres_version}
    sleep  15
}

setup_network() {
	docker network rm testing5 || true
	docker network create testing5 || true
	docker ps
	docker network connect testing5 ${mysql_container_name}
	docker network connect testing5 ${mongodb_container_name}
	docker network connect testing5 ${postgres_container_name}
	sleep 10
}

setup_pmm-server() {
    docker pull percona/pmm-server:2
    docker stop ${pmm_server_container_name} || true
    docker rm ${pmm_server_container_name} || true
    docker rm pmm-data || true
    docker create --volume /srv --name pmm-data percona/pmm-server:2 /bin/true
    echo "Starting pmm-server container"
    docker run --detach --publish 443:443 --volumes-from pmm-data --name ${pmm_server_container_name} percona/pmm-server:2
    docker network connect testing5 ${pmm_server_container_name}
    sleep 60
}
 
setup_pmm-client() {
	docker pull percona/pmm-client:2
    docker stop ${pmm_client_container_name} || true
    docker rm ${pmm_client_container_name} || true
    docker run --name ${pmm_client_container_name} --network testing5 -e PMM_AGENT_SERVER_ADDRESS=pmm-server:443 -e PMM_AGENT_SERVER_USERNAME=admin -e PMM_AGENT_SERVER_PASSWORD=admin -e PMM_AGENT_SERVER_INSECURE_TLS=1 -e PMM_AGENT_SETUP=1 -e PMM_AGENT_CONFIG_FILE=config/pmm-agent.yaml -d percona/pmm-client:2
   
}

adding_pmm-server() {
	docker exec pmm-client pmm-admin remove mysql ${mysql_container_name} || true
	sleep 15
	docker exec pmm-client pmm-admin add mysql --host=${mysql_container_name} --username=root --password=my-secret-pw --query-source=perfschema mysql
	sleep 15
	docker exec pmm-client pmm-admin remove mongodb ${mongodb_container_name} || true
	docker exec pmm-client pmm-admin add mongodb --host=${mongodb_container_name} --username=admin --password=mysecretpassword --query-source=profiler mongodb
	sleep 15
	docker exec pmm-client pmm-admin remove postgresql ${postgres_container_name} || true
	docker exec pmm-client pmm-admin add postgresql --host=${postgres_container_name} --username=postgres --password=mysecretpassword postgresql
	sleep 15
}

sysbench_setup() {
 	docker pull severalnines/sysbench 
    docker stop sb-prepare || true
    docker rm sb-prepare || true
    docker run --rm=true --name=sb-prepare --network testing5 severalnines/sysbench sysbench --db-driver=mysql --oltp-table-size=100000 --oltp-tables-count=10 --threads=1 --mysql-host=${mysql_container_name} --mysql-port=3306 --mysql-user=sbtest1 --mysql-password=testing1 /usr/share/sysbench/tests/include/oltp_legacy/parallel_prepare.lua run
    sleep 10
    docker stop sb-run || true
    docker rm sb-run || true
    docker run --name=sb-run --network testing5 severalnines/sysbench sysbench --db-driver=mysql --report-interval=2 --myql-table-engine=innodb --oltp-table-size=100000 --oltp-tables-count=10 --threads=1 --time=1200 --mysql-host=${mysql_container_name} --mysql-port=3306 --mysql-user=sbtest1 --mysql-password=testing1 /usr/share/sysbench/tests/include/oltp_legacy/oltp.lua run
}

# Establish run order
main() {
    setup_mysql
    setup_mongodb
    setup_postgres
    setup_network
    setup_pmm-server
    setup_pmm-client
    adding_pmm-server
    sysbench_setup
}

echo "Calling Main"
main
