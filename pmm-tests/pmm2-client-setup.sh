#!/bin/bash

function jsonval {
    temp=`echo $json | sed 's/\\\\\//\//g' | sed 's/[{}]//g' | awk -v k="text" '{n=split($0,a,","); for (i=1; i<=n; i++) print a[i]}' | sed 's/\"\:\"/\|/g' | sed 's/[\,]/ /g' | sed 's/\"//g' | grep -w $prop`
    echo ${temp##*|}
}

usage(){
  echo "Usage: [ options ]"
  echo "Please make sure to pass atleast pmm_server, which_db, db_server, db_user"
  echo " --pmm-server-url               Pass pmm-server url (eg. localhost:80)"
  echo " --which-db                     Specify DB: mysql/mongodb/postgresql"
  echo " --db-server                    Pass db_server url (eg. localhost:3306)"
  echo " --db-user                      Pass DB username (eg. root)"
  echo " --db-password                  Pass DB password"
  echo " --install-client               Install PMM2-client"
  echo " --dev                          This will install from development release repository"
  echo " --client-version               Pass specific PMM2-client version"
  echo " --help                         Display usage"
}

# Check if we have a functional getopt(1)
if ! getopt --test
  then
  go_out="$(getopt --options=u: --longoptions=pmm-server-url:,which-db:,db-server:,db-user:,db-password:,install-client,dev,client-version:,help \
  --name="$(basename "$0")" -- "$@")"
  test $? -eq 0 || exit 1
  eval set -- $go_out
fi

if [[ $go_out == " --" ]];then
  usage
  exit 1
fi

for arg
do
  case "$arg" in
    -- ) shift; break;;
    --pmm-server-url )
    STR=$2
    IFS=’:’ read -ra pmm_server_with_port <<< "$STR" 
    pmm_server=${pmm_server_with_port[0]}
    pmm_server_port=${pmm_server_with_port[1]}
    shift 2
    ;;
    --which-db )
    which_db="$2"
    shift 2
    ;;
    --db-server )
    MSTR=$2
    IFS=’:’ read -ra db_server_with_port <<< "$MSTR"
    db_server=${db_server_with_port[0]}
    db_server_port=${db_server_with_port[1]}
    shift 2
    ;;
    --db-user )
    db_user="$2"
    shift 2
    ;;
    --db-password )
    db_password="$2"
    shift 2
    ;;
    --install-client )
    install_client=1
    shift 2
    ;;
    --dev )
    shift
    dev=1
    ;;
    --client-version )
    client_version="$2"
    shift 2
    ;;
    --help )
    usage
    exit 0
    ;;
  esac
done


if [ -z "$pmm_server_port" ]
then
  pmm_server_port=80
fi


node_name=node$((1 + RANDOM % 100))
json=`curl -d '{"address": "'${pmm_server}'", "custom_labels": {"custom_label": "for_node"}, "node_name": "'$node_name'"}' http://$pmm_server:$pmm_server_port/v1/inventory/Nodes/AddGeneric`
prop='node_id'
node_id=`jsonval`

json=`curl -d '{"custom_labels": {"custom_label2": "for_pmm-agent"}, "runs_on_node_id": "'$node_id'"}' http://$pmm_server:$pmm_server_port/v1/inventory/Agents/AddPMMAgent`
prop='agent_id'
agent_id=`jsonval`
echo $agent_id
echo $node_id

sudo pmm-agent setup --server-address=$pmm_server:443 --server-insecure-tls --id=$agent_id --trace  > $PWD/pmm-agent.logs 2>&1 &

sleep 10


json=`curl -d '{"custom_labels": {"custom_label5": "for_node_exporter"}, "pmm_agent_id": "'$agent_id'", "service_id": "'$service_id'"}' \
     http://$pmm_server:$pmm_server_port/v1/inventory/Agents/AddNodeExporter`
prop='runs_on_node_id'
runs_on_node_id=`jsonval`
echo $runs_on_node_id

install() {
	echo "Installing PMM2-Client..."
}

configure_mysql(){
	if [ -z "$db_server_port" ]
	then
	      db_server_port='3306'
	fi
	service_name=mysql-$((1 + RANDOM % 100))
	json=`curl -d '{"address": "'${db_server}'", "port": '${db_server_port}', "custom_labels": {"custom_label3": "for_service"}, "node_id": "'$node_id'", "service_name": "'$service_name'"}' \
	http://$pmm_server:$pmm_server_port/v1/inventory/Services/AddMySQL`
	prop='service_id'
	service_id=`jsonval`
	echo $service_id

	json=`curl -d '{"custom_labels": {"custom_label4": "for_mysql_exporter"}, "pmm_agent_id": "'$agent_id'", "service_id": "'$service_id'", "username": "'$db_user'", "password": "'$db_password'"}' \
	http://$pmm_server:$pmm_server_port/v1/inventory/Agents/AddMySQLdExporter`
	prop='runs_on_node_id'
	runs_on_node_id=`jsonval`
	echo $runs_on_node_id

  json=`curl -d '{"custom_labels": {"custom_label6": "for_perfschemaAgent"}, "pmm_agent_id": "'$agent_id'", "service_id": "'$service_id'", "username": "'$db_user'", "password": "'$db_password'"}' \
  http://$pmm_server:$pmm_server_port/v1/inventory/Agents/AddQANMySQLPerfSchemaAgent`
}

configure_mongodb(){
	service_name=mongodb-$((1 + RANDOM % 100))
	json=`curl -d '{"address": "'${db_server}'", "port": '${db_server_port}', "custom_labels": {"custom_label3": "for_service"}, "node_id": "'$node_id'", "service_name": "'$service_name'"}' \
	http://$pmm_server:$pmm_server_port/v1/inventory/Services/AddMongoDB`
 	prop='service_id'
	service_id=`jsonval`
	echo $service_id

	json=`curl -d '{"custom_labels": {"custom_label4": "for_exporter"}, "pmm_agent_id": "'$agent_id'", "service_id": "'$service_id'", "username": "'$db_user'", "password": "'$db_password'"}' \
	http://$pmm_server:$pmm_server_port/v1/inventory/Agents/AddMongoDBExporter`
	prop='runs_on_node_id'
	runs_on_node_id=`jsonval`
	echo $runs_on_node_id
}

configure_postgresql(){
	service_name=postgres-$((1 + RANDOM % 100))
	json=`curl -d '{"address": "'${db_server}'", "port": '${db_server_port}', "custom_labels": {"custom_label6": "for_postgres_service"}, "node_id": "'$node_id'", "service_name": "'$service_name'"}' \
	http://$pmm_server:$pmm_server_port/v1/inventory/Services/AddPostgreSQL`
 	prop='service_id'
	service_id=`jsonval`
	echo $service_id

	json=`curl -d '{"custom_labels": {"custom_label4": "for_postgres_exporter"}, "pmm_agent_id": "'$agent_id'", "service_id": "'$service_id'", "username": "'$db_user'", "password": "'$db_password'"}' \
	http://$pmm_server:$pmm_server_port/v1/inventory/Agents/AddPostgresExporter`
	prop='runs_on_node_id'
	runs_on_node_id=`jsonval`
	echo $runs_on_node_id
}

if [ ! -z $install_client ]; then
	install
fi

if [ "$which_db" == "mysql" ]; then
	configure_mysql
fi

if [ "$which_db" == "mongodb" ]; then
	configure_mongodb
fi

if [ "$which_db" == "postgresql" ]; then
	configure_postgresql
fi
