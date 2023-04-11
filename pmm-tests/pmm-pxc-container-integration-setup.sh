#!/bin/bash

# TESTED FOR GNU bash, version 5.1.16(1)-release (x86_64-pc-linux-gnu)

set -xe

create_network(){

    docker network create $1

}

cleanup(){

docker rm -f $(docker ps -aq --filter='name=node') || true
docker rm -f proxysql-server|| true
docker rm -f pmm-server || true
docker network rm -f $(docker network ls --filter='name=network' | grep network | awk '{print$1}') || true


}

start_pmm_container(){

    #start_pmm_container image_tag
    docker run -d \
    -e PMM_DEBUG=1 \
    -e ENABLE_BACKUP_MANAGEMENT=1 \
    --name=pmm-server \
    --net=$2 \
    -p 443:443 -p 8081:80 \
    percona/pmm-server:$1
    sleep 90

}

create_proxysql_config(){

cat <<EOF > proxysql-admin.cnf


export PROXYSQL_DATADIR='/var/lib/proxysql'
export PROXYSQL_USERNAME='admin'
export PROXYSQL_PASSWORD='admin'
export PROXYSQL_HOSTNAME='0.0.0.0'
export PROXYSQL_PORT='6032'

# PXC admin credentials for connecting to the pxc-cluster-node.
export CLUSTER_USERNAME='root'
export CLUSTER_PASSWORD='root'
export CLUSTER_HOSTNAME='node1'
export CLUSTER_PORT='3306'

# proxysql monitoring user. proxysql admin script will create this user in pxc to monitor pxc-nodes.
export MONITOR_USERNAME='monitor'
export MONITOR_PASSWORD='monit0r'

# Application user to connect to pxc-node through proxysql
export CLUSTER_APP_USERNAME='proxysql_user'
export CLUSTER_APP_PASSWORD='passw0rd'

# ProxySQL hostgroup IDs
export WRITER_HOSTGROUP_ID='10'
export READER_HOSTGROUP_ID='11'
export BACKUP_WRITER_HOSTGROUP_ID='12'
export OFFLINE_HOSTGROUP_ID='13'

# ProxySQL read/write configuration mode.
export MODE="singlewrite"

# max_connections default (used only when INSERTing a new mysql_servers entry)
export MAX_CONNECTIONS="1000"

# Determines the maximum number of writesets a node can have queued
# before the node is SHUNNED to avoid stale reads.
export MAX_TRANSACTIONS_BEHIND=100

# Connections to the backend servers (from ProxySQL) will use SSL
export USE_SSL="yes"

# Determines if a node should be added to the reader hostgroup if it has
# been promoted to the writer hostgroup.
# If set to 'yes', then all writers (including backup-writers) are added to
# the read hostgroup.
# If set to 'no', then none of the writers (including backup-writers) are added.
# If set to 'backup', then only the backup-writers will be added to
# the read hostgroup.
export WRITERS_ARE_READERS="backup"



EOF



cat <<EOF > proxysql.cnf

#file proxysql.cfg

########################################################################################
# This config file is parsed using libconfig , and its grammar is described in:        
# http://www.hyperrealm.com/libconfig/libconfig_manual.html#Configuration-File-Grammar 
# Grammar is also copied at the end of this file                                       
########################################################################################

########################################################################################
# IMPORTANT INFORMATION REGARDING THIS CONFIGURATION FILE:                             
########################################################################################
# On startup, ProxySQL reads its config file (if present) to determine its datadir. 
# What happens next depends on if the database file (disk) is present in the defined
# datadir (i.e. "/var/lib/proxysql/proxysql.db").
#
# If the database file is found, ProxySQL initializes its in-memory configuration from 
# the persisted on-disk database. So, disk configuration gets loaded into memory and 
# then propagated towards the runtime configuration. 
#
# If the database file is not found and a config file exists, the config file is parsed 
# and its content is loaded into the in-memory database, to then be both saved on-disk 
# database and loaded at runtime.
#
# IMPORTANT: If a database file is found, the config file is NOT parsed. In this case
#            ProxySQL initializes its in-memory configuration from the persisted on-disk
#            database ONLY. In other words, the configuration found in the proxysql.cnf
#            file is only used to initial the on-disk database read on the first startup.
#
# In order to FORCE a re-initialise of the on-disk database from the configuration file 
# the ProxySQL service should be started with "systemctl start proxysql-initial".
#
########################################################################################

datadir="/var/lib/proxysql"
errorlog="/var/lib/proxysql/proxysql.log"

admin_variables=
{
	admin_credentials="admin:admin;radminuser:radminpass"
#	mysql_ifaces="127.0.0.1:6032;/tmp/proxysql_admin.sock"
	mysql_ifaces="0.0.0.0:6032"
#	refresh_interval=2000
#	debug=true
}

mysql_variables=
{
	threads=4
	max_connections=2048
	default_query_delay=0
	default_query_timeout=36000000
	have_compress=true
	poll_timeout=2000
#	interfaces="0.0.0.0:6033;/tmp/proxysql.sock"
	interfaces="0.0.0.0:6033"
	default_schema="information_schema"
	stacksize=1048576
	server_version="5.5.30"
	connect_timeout_server=3000
# make sure to configure monitor username and password
# https://github.com/sysown/proxysql/wiki/Global-variables#mysql-monitor_username-mysql-monitor_password
	monitor_username="monitor"
	monitor_password="monitor"
	monitor_history=600000
	monitor_connect_interval=60000
	monitor_ping_interval=10000
	monitor_read_only_interval=1500
	monitor_read_only_timeout=500
	ping_interval_server_msec=120000
	ping_timeout_server=500
	commands_stats=true
	sessions_sort=true
	connect_retries_on_failure=10
}


# defines all the MySQL servers
mysql_servers =
(
#	{
#		address = "127.0.0.1" # no default, required . If port is 0 , address is interpred as a Unix Socket Domain
#		port = 3306           # no default, required . If port is 0 , address is interpred as a Unix Socket Domain
#		hostgroup = 0	        # no default, required
#		status = "ONLINE"     # default: ONLINE
#		weight = 1            # default: 1
#		compression = 0       # default: 0
#   max_replication_lag = 10  # default 0 . If greater than 0 and replication lag passes such threshold, the server is shunned
#	},
#	{
#		address = "/var/lib/mysql/mysql.sock"
#		port = 0
#		hostgroup = 0
#	},
#	{
#		address="127.0.0.1"
#		port=21891
#		hostgroup=0
#		max_connections=200
#	},
#	{ address="127.0.0.2" , port=3306 , hostgroup=0, max_connections=5 },
#	{ address="127.0.0.1" , port=21892 , hostgroup=1 },
#	{ address="127.0.0.1" , port=21893 , hostgroup=1 }
#	{ address="127.0.0.2" , port=3306 , hostgroup=1 },
#	{ address="127.0.0.3" , port=3306 , hostgroup=1 },
#	{ address="127.0.0.4" , port=3306 , hostgroup=1 },
#	{ address="/var/lib/mysql/mysql.sock" , port=0 , hostgroup=1 }
)


# defines all the MySQL users
mysql_users:
(
#	{
#		username = "username" # no default , required
#		password = "password" # default: ''
#		default_hostgroup = 0 # default: 0
#		active = 1            # default: 1
#	},
#	{
#		username = "root"
#		password = ""
#		default_hostgroup = 0
#		max_connections=1000
#		default_schema="test"
#		active = 1
#	},
#	{ username = "user1" , password = "password" , default_hostgroup = 0 , active = 0 }
)



#defines MySQL Query Rules
mysql_query_rules:
(
#	{
#		rule_id=1
#		active=1
#		match_pattern="^SELECT .* FOR UPDATE$"
#		destination_hostgroup=0
#		apply=1
#	},
#	{
#		rule_id=2
#		active=1
#		match_pattern="^SELECT"
#		destination_hostgroup=1
#		apply=1
#	}
)

scheduler=
(
#  {
#    id=1
#    active=0
#    interval_ms=10000
#    filename="/var/lib/proxysql/proxysql_galera_checker.sh"
#    arg1="0"
#    arg2="0"
#    arg3="0"
#    arg4="1"
#    arg5="/var/lib/proxysql/proxysql_galera_checker.log"
#  }
)


mysql_replication_hostgroups=
(
#        {
#                writer_hostgroup=30
#                reader_hostgroup=40
#                comment="test repl 1"
#       },
#       {
#                writer_hostgroup=50
#                reader_hostgroup=60
#                comment="test repl 2"
#        }
)




# http://www.hyperrealm.com/libconfig/libconfig_manual.html#Configuration-File-Grammar
#
# Below is the BNF grammar for configuration files. Comments and include directives are not part of the grammar, so they are not included here. 
#
# configuration = setting-list | empty
#
# setting-list = setting | setting-list setting
#     
# setting = name (":" | "=") value (";" | "," | empty)
#     
# value = scalar-value | array | list | group
#     
# value-list = value | value-list "," value
#     
# scalar-value = boolean | integer | integer64 | hex | hex64 | float
#                | string
#     
# scalar-value-list = scalar-value | scalar-value-list "," scalar-value
#     
# array = "[" (scalar-value-list | empty) "]"
#     
# list = "(" (value-list | empty) ")"
#     
# group = "{" (setting-list | empty) "}"
#     
# empty =


EOF


}


start_proxysql_container(){

    docker run -d \
    --name=proxysql-server \
    --net=$2 \
    -v $PWD/proxysql-admin.cnf:/etc/proxysql-admin.cnf \
    -v $PWD/proxysql.cnf:/etc/proxysql.cnf \
    percona/proxysql2:$1
    sleep 90

}

add_pxc_to_proxysql(){

docker exec -it proxysql-server proxysql-admin --config=/etc/proxysql-admin.cnf --enable

}


change_pmm_password(){
    #change_pmm_password password
    docker exec pmm-server change-admin-password $1

}

bootstrap_pxc_57_container(){

    # bootstrap_pxc_container rootpass clustername nameof_node network_name pxc_docker_image_tag

    docker run -d \
    -e MYSQL_ROOT_PASSWORD=$1 \
    -e CLUSTER_NAME=$2 \
    --name=$3 \
    --net=$4 \
    percona/percona-xtradb-cluster:$5
    sleep 90

    # Creating sysbench user on pxc-node1

    docker exec -i $3 mysql -uroot -p$1  <<< " CREATE SCHEMA sbtest; CREATE USER sbtest@'%' IDENTIFIED BY 'password'; GRANT ALL PRIVILEGES ON sbtest.* to sbtest@'%'; "

}

bootstrap_pxc_80_container(){
    
    docker run -d \
    -e MYSQL_ROOT_PASSWORD=$1 \
    -e CLUSTER_NAME=$2 \
    --name=$3 \
    --net=$4 \
    -v $PWD/cert:/cert \
    -v $PWD/config:/etc/percona-xtradb-cluster.conf.d \
    percona/percona-xtradb-cluster:$5
    
    sleep 90

    # Creating sysbench user on pxc-node1

    docker exec -i $3 mysql -uroot -p$1  <<< " CREATE SCHEMA sbtest; CREATE USER sbtest@'%' IDENTIFIED BY 'password'; GRANT ALL PRIVILEGES ON sbtest.* to sbtest@'%'; "

}

add_pxc_57_container_to_cluster(){

    # add_pxc_container_to_cluster rootpass clustername clusterjoin_node nameof_node network_name pxc_docker_image_tag
    
    docker run -d \
    -e MYSQL_ROOT_PASSWORD=$1 \
    -e CLUSTER_NAME=$2 \
    -e CLUSTER_JOIN=$3 \
    --name=$4 \
    --net=$5 \
    percona/percona-xtradb-cluster:$6

}

add_pxc_80_container_to_cluster(){

    docker run -d \
    -e MYSQL_ROOT_PASSWORD=$1 \
    -e CLUSTER_NAME=$2 \
    -e CLUSTER_JOIN=$3 \
    --name=$4 \
    --net=$5 \
    -v $PWD/cert:/cert \
    -v $PWD/config:/etc/percona-xtradb-cluster.conf.d \
    percona/percona-xtradb-cluster:$6

}

add_pxc_pxc57_to_pmm(){

    docker exec -t pmm-server pmm-admin add mysql --username=root --password=$1 --tls-skip-verify --server-url=http://admin:$2@127.0.0.1 --query-source=perfschema $3 $3:3306

}

add_pxc_pxc80_to_pmm(){

    docker exec -t pmm-server pmm-admin add mysql --username=root --password=$1 --tls-skip-verify --server-url=http://admin:$2@127.0.0.1 --query-source=perfschema $3 $3:3306

}

add_proxysql_to_pmm(){

    docker exec -t pmm-server pmm-admin add proxysql --username=pmmstatsuser --password=$1 --tls-skip-verify --server-url=http://admin:$2@127.0.0.1 --host=proxysql-server --port=6032

}


n_node_pxc57_cluster(){

    bootstrap_pxc_57_container root cluster1 node1 network1 $2
    add_pxc_pxc57_to_pmm root admin123 node1

    for i in $(eval echo "{2..$1}")
    do
        add_pxc_57_container_to_cluster root cluster1 node1 node$i network1 $2
    done

    sleep 90

    for i in $(eval echo "{2..$1}")
    do
        add_pxc_pxc57_to_pmm root admin123 node$i
    done

}

n_node_pxc80_cluster(){

    bootstrap_pxc_80_container root cluster1 node1 network80 $2
    add_pxc_pxc80_to_pmm root admin123 node1

    for i in $(eval echo "{2..$1}")
    do
        add_pxc_80_container_to_cluster root cluster1 node1 node$i network80 $2
    done

    sleep 90

    for i in $(eval echo "{2..$1}")
    do
        add_pxc_pxc80_to_pmm root admin123 node$i
    done


}


sysbench_run(){

# Run the sysbench docker container and execute the sysbench tests on the pxc-node1

# sysbench_run network_name node_name

docker run --rm=true --net=$1 --name=sb-prepare severalnines/sysbench sysbench --db-driver=mysql --oltp-table-size=100000 --oltp-tables-count=24 --threads=1 --mysql-host=$2 --mysql-port=3306 --mysql-user=sbtest --mysql-password=password /usr/share/sysbench/tests/include/oltp_legacy/parallel_prepare.lua run


}

create_certs() {
    
mkdir -p config
cat <<EOF > config/config.cnf

[mysqld]
ssl-ca = /cert/ca.pem
ssl-cert = /cert/server-cert.pem
ssl-key = /cert/server-key.pem

[client]
ssl-ca = /cert/ca.pem
ssl-cert = /cert/client-cert.pem
ssl-key = /cert/client-key.pem

[sst]
encrypt = 4
ssl-ca = /cert/ca.pem
ssl-cert = /cert/server-cert.pem
ssl-key = /cert/server-key.pem
EOF

}


setup_pxc_5.7(){

    create_network network1
    start_pmm_container $3 network1
    change_pmm_password admin123
    n_node_pxc57_cluster $1 $2
    # $1 is Number of Nodes
    # $2 is Docker image Tag
    sleep 120
    sysbench_run network1 node1

}


setup_pxc_8.0(){
    create_certs

    mkdir -m 777 -p cert
    docker run --name pxc-cert --network host --rm -v $PWD/cert:/cert percona/percona-xtradb-cluster:8.0 mysql_ssl_rsa_setup -d /cert
    create_network network80
    start_pmm_container $3 network80
    change_pmm_password admin123
    n_node_pxc80_cluster $1 $2
    # $1 is Number of Nodes
    # $2 is Docker image Tag
    sleep 120
    sysbench_run network80 node1

}

setup_proxysql(){

    create_proxysql_config

    if [ $(echo "$pxc_version" | grep 8.0 > /dev/null ; echo $?) -eq 0 ];
    then
        start_proxysql_container latest network80
    elif [ $(echo "$pxc_version" | grep 5.7 > /dev/null ; echo $?) -eq 0 ];
    then
        start_proxysql_container latest network1
    else
	echo "invalid"
    fi
    
    add_pxc_to_proxysql

    echo "...Checking the cluster..."
    
    docker exec -it proxysql-server mysql -uadmin -padmin -h 127.0.0.1 -P6032 -e " SELECT * FROM mysql_servers; "

    echo "-------------------------------------ADD A NEW ADMIN USER----------------------------------------------"

    docker exec -it proxysql-server mysql -uadmin -padmin -h 127.0.0.1 -P6032 -e "set admin-admin_credentials=\"admin:admin;radminuser:radminpass\""

    docker exec -it proxysql-server mysql -uadmin -padmin -h 127.0.0.1 -P6032 -e "set admin-stats_credentials=\"stats:stats;pmmstatsuser:pmmstatspass\""

    docker exec -it proxysql-server mysql -uadmin -padmin -h 127.0.0.1 -P6032 -e "LOAD ADMIN VARIABLES TO RUNTIME;"

    docker exec -it proxysql-server mysql -uadmin -padmin -h 127.0.0.1 -P6032 -e "SAVE ADMIN VARIABLES FROM RUNTIME;"


}



cleanup
cluster_size=$1
pxc_version=$2
pmm_version=$3
addons=$4

output=$(echo "$pxc_version" | grep 8.0 > /dev/null ; echo $?)

echo $output

if [ $(echo "$pxc_version" | grep 5.7 > /dev/null ; echo $?) -eq 0 ];
then

    echo "Selected 5.7"
    setup_pxc_5.7 $cluster_size $pxc_version $pmm_version

elif [ $(echo "$pxc_version" | grep 8.0 > /dev/null ; echo $?) -eq 0 ];
then

    echo "Selected 8.0"
    setup_pxc_8.0 $cluster_size $pxc_version $pmm_version

else

    echo invalid

fi



if [ "$addons" == "proxysql" ];
then

echo "Add the PROXYSQL TO THE PXC AND PMM SETUP"
setup_proxysql
add_proxysql_to_pmm pmmstatspass admin123
else

echo "Skipping proxysql"

fi
