#!/bin/bash

while [ $# -gt 0 ]; do

   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi

  shift
done

if [ -z "$number_of_nodes" ]
then
      export number_of_nodes=3
fi

if [ -z "$ps_version" ]
then
      export ps_version=8.0
fi

if [ -z "$ps_tarball" ]
then
      export ps_tarball="https://downloads.percona.com/downloads/Percona-Server-8.0/Percona-Server-8.0.40-31/binary/tarball/Percona-Server-8.0.40-31-Linux.x86_64.glibc2.35-minimal.tar.gz"
fi

if [ -z "$query_source" ]
then
      export query_source=slowlog
fi

export PS_PORT=3307
export PS_USER=msandbox
export PS_PASSWORD=msandbox
touch sysbench_prepare.txt
touch sysbench_run.txt

## Setup DB deployer
curl -L -s https://bit.ly/dbdeployer | bash || true

### Get the tarball
wget ${ps_tarball}
mkdir ~/ps${ps_version} || true
mkdir /tmp || true
chmod 1777 /tmp || true

## Deploy DB deployer
export tar_ball_name=$(ls Percona-Server*)
dbdeployer unpack ${tar_ball_name} --sandbox-binary=~/ps${ps_version} --flavor=percona
export db_version_sandbox=$(ls ~/ps${ps_version})

export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
export SERVICE_RANDOM_NUMBER=$((1 + $RANDOM % 9999))

# Initialize my_cnf_options
my_cnf_options=""

if [[ "$number_of_nodes" -gt 1 ]]; then
  # Check if ps_version is greater than 8.0
  if [[ "$ps_version" =~ ^8\.[1-9]([0-9])? || "$ps_version" =~ ^9\.[0-9]+ ]]; then
    my_cnf_options="caching_sha2_password_auto_generate_rsa_keys=ON"
  else
    # MySQL 5.7, create user fails which already exists, to ignore this we do:
    my_cnf_options="replicate-ignore-table=mysql.user"
  fi
fi

if [[ "$number_of_nodes" == 1 ]];then
   if [[ ! -z $group_replication ]]; then
      dbdeployer deploy --topology=group replication ${db_version_sandbox} --single-primary --sandbox-binary=~/ps${ps_version} --remote-access=% --bind-address=0.0.0.0 --force ${my_cnf_options:+--my-cnf-options="$my_cnf_options"}
      export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
      node_port=`dbdeployer sandboxes --header | grep ${db_version_sandbox} | grep 'group-single-primary' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'GRgrO9301RuF';"
   else
      dbdeployer deploy single ${db_version_sandbox} --sandbox-binary=~/ps${ps_version} --port=${PS_PORT} --remote-access=% --bind-address=0.0.0.0 --force ${my_cnf_options:+--my-cnf-options="$my_cnf_options"}
      export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
      node_port=`dbdeployer sandboxes --header | grep  ${db_version_sandbox} | grep 'single' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'GRgrO9301RuF';"
      if [[ "${query_source}" == "slowlog" ]]; then
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL slow_query_log='ON';"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL long_query_time=0;"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_rate_limit=1;"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_admin_statements=ON;"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_slave_statements=ON;"
      else
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL userstat=1;"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL innodb_monitor_enable=all;"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE '%statements%';"
              if echo "$ps_version" | grep '5.7'; then
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_AUDIT SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_READ SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_WRITE SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL query_response_time_stats=ON;"
              fi
      fi
   fi
   if [[ ! -z $group_replication ]]; then
      for j in `seq 1  3`;do
        if [[ "${query_source}" == "slowlog" ]]; then
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL slow_query_log='ON';"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL long_query_time=0;"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_rate_limit=1;"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_admin_statements=ON;"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_slave_statements=ON;"
        else
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL userstat=1;"
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL innodb_monitor_enable=all;"
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE '%statements%';"
              if echo "$ps_version" | grep '5.7'; then
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_AUDIT SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_READ SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_WRITE SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL query_response_time_stats=ON;"
              fi
        fi
        #run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-group-replication-node
        pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ms-prod --cluster=ps-prod-cluster --replication-set=ps-repl ps-group-replication-node-$j-${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:$node_port
        node_port=$(($node_port + 1))
        sleep 20
        done
   else
      #run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-single
      pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=dev --cluster=dev-cluster --replication-set=repl1 ps-single-${SERVICE_RANDOM_NUMBER} 127.0.0.1:$node_port
      sleep 20
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "set long_query_time = 0; INSERT INTO T2033 ( ID, Value ) VALUES (1,1)" || true
   fi
else
     dbdeployer deploy multiple ${db_version_sandbox} --sandbox-binary=~/ps${ps_version} --nodes $number_of_nodes --force --remote-access=% --bind-address=0.0.0.0 --my-cnf-options=gtid_mode=ON --my-cnf-options=enforce-gtid-consistency=ON --my-cnf-options=binlog-format=ROW --my-cnf-options=log-slave-updates=ON --my-cnf-options=binlog-checksum=NONE ${my_cnf_options:+--my-cnf-options="$my_cnf_options"}
     export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
     master_port=`dbdeployer sandboxes --header | grep ${db_version_sandbox} | grep 'multiple' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
     if echo "$ps_version" | grep '5.7'; then
       slave_port=`dbdeployer sandboxes --header | grep ${db_version_sandbox} | grep 'multiple' | awk -F'[' '{print $2}' | awk -F' ' '{print $2}'`
     else
       slave_port=`dbdeployer sandboxes --header | grep ${db_version_sandbox} | grep 'multiple' | awk -F'[' '{print $2}' | awk -F' ' '{print $3}'`
     fi
     mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $master_port -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'GRgrO9301RuF';"
     mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $master_port -e "FLUSH PRIVILEGES;"
     mysql -h 127.0.0.1 -u root -p'GRgrO9301RuF' --port $master_port -e "CREATE USER 'repl'@'%' IDENTIFIED  BY 'repl_pass';"
     mysql -h 127.0.0.1 -u root -p'GRgrO9301RuF' --port $master_port -e "GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'repl'@'%';"
     mysql -h 127.0.0.1 -u root -p'GRgrO9301RuF' --port $master_port -e "FLUSH PRIVILEGES;"
     if echo "$ps_version" | grep '5.7'; then
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $slave_port -e "CHANGE MASTER TO MASTER_HOST='127.0.0.1', MASTER_USER='repl', MASTER_PASSWORD='repl_pass', MASTER_PORT=${master_port}, MASTER_AUTO_POSITION=1;"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $slave_port -e "START SLAVE;"
     else
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $slave_port -e "CHANGE REPLICATION SOURCE TO SOURCE_HOST='127.0.0.1', SOURCE_USER='repl', SOURCE_PASSWORD='repl_pass', SOURCE_PORT=${master_port}, SOURCE_AUTO_POSITION=1, SOURCE_SSL=1;"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $slave_port -e "START REPLICA;"
     fi
     for port in $master_port $slave_port; do
        if [[ "${query_source}" == "slowlog" ]]; then
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "SET GLOBAL slow_query_log='ON';"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "SET GLOBAL long_query_time=0;"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "SET GLOBAL log_slow_rate_limit=1;"
      	   mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "SET GLOBAL log_slow_admin_statements=ON;"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "SET GLOBAL log_slow_slave_statements=ON;"
        else
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "SET GLOBAL userstat=1;"
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "SET GLOBAL innodb_monitor_enable=all;"
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE '%statements%';"
              if echo "$ps_version" | grep '5.7'; then
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_AUDIT SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_READ SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_WRITE SONAME 'query_response_time.so';"
                  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $port -e "SET GLOBAL query_response_time_stats=ON;"
              fi
        fi
        if [[ "$port" == "$master_port" ]]; then
          pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ps-dev --cluster=ps-dev-cluster --replication-set=ps-repl1 ps-multiple-master-${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:$master_port
        else
          pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ps-dev --cluster=ps-dev-cluster --replication-set=ps-repl1 ps-multiple-slave-${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:$slave_port
        fi
        #run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-multiple-node
        sleep 20

        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "set long_query_time = 0; INSERT INTO T2033 ( ID, Value ) VALUES (1,1)" || true
    done
fi

## Start Running Load
~/sandboxes/${db_sandbox}/sysbench_ready prepare > sysbench_prepare.txt 2>&1 &
sleep 120
~/sandboxes/${db_sandbox}/sysbench_ready run > sysbench_run.txt 2>&1 &
