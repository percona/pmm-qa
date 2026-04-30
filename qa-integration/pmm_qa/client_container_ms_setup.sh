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
      export number_of_nodes=1
fi

if [ -z "$ms_version" ]
then
      export ms_version="8.0"
fi

if [ -z "$ms_tarball" ]
then
      export ms_tarball="https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.40-linux-glibc2.17-x86_64-minimal.tar.xz"
fi

if [ -z "$query_source" ]
then
      export query_source=perfschema
fi

touch sysbench_prepare.txt
touch sysbench_run.txt

## Setup DB deployer
curl -L -s https://bit.ly/dbdeployer | bash || true

### Get the tarball
wget ${ms_tarball}
mkdir ~/ms${ms_version} || true
mkdir /tmp || true
chmod 1777 /tmp || true

## Deploy DB deployer
export MS_PORT=3308
export tar_ball_name=$(ls mysql-*)
dbdeployer unpack ${tar_ball_name} --sandbox-binary=~/ms${ms_version} --overwrite
export db_version_sandbox=$(ls ~/ms${ms_version})
export SERVICE_RANDOM_NUMBER=$((1 + $RANDOM % 9999))

# Initialize my_cnf_options
my_cnf_options=""

# Check if ps_version is 8.4 or greater to enable the plugin to change the password
if [[ "$ms_version" =~ ^8\.[4-9]([0-9])? || "$ms_version" =~ ^[9-9][0-9]\. ]]; then
  my_cnf_options="mysql-native-password=ON"
fi

if [[ "$number_of_nodes" == 1 ]];then
   if [[ ! -z $group_replication ]]; then
      dbdeployer deploy --topology=group replication ${db_version_sandbox} --single-primary --sandbox-binary=~/ms${ms_version} --remote-access=% --bind-address=0.0.0.0 --force ${my_cnf_options:+--my-cnf-options="$my_cnf_options"}
      export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
      node_port=`dbdeployer sandboxes --header | grep ${db_version_sandbox} | grep 'group-single-primary' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'GRgrO9301RuF';"
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL innodb_monitor_enable=all;"
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE '%statements%';"
   else
      dbdeployer deploy single ${db_version_sandbox} --sandbox-binary=~/ms${ms_version} --port=$MS_PORT --remote-access=% --bind-address=0.0.0.0 --force ${my_cnf_options:+--my-cnf-options="$my_cnf_options"}
      export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
      node_port=`dbdeployer sandboxes --header | grep  ${db_version_sandbox} | grep 'single' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'GRgrO9301RuF';"
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL innodb_monitor_enable=all;"
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE '%statements%';"
      if [[ "${query_source}" == "slowlog" ]]; then
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL slow_query_log='ON';"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL long_query_time=0;"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_admin_statements=ON;"
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_slave_statements=ON;"
      fi
   fi
   if [[ ! -z $group_replication ]]; then
      for j in `seq 1  3`;do
        if [[ "${query_source}" == "slowlog" ]]; then
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL slow_query_log='ON';"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL long_query_time=0;"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_admin_statements=ON;"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_slave_statements=ON;"
        fi
        #run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-group-replication-node
        pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ms-prod --cluster=ms-prod-cluster --replication-set=ms-repl ms-group-replication-node-$j-${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:$node_port
        node_port=$(($node_port + 1))
        sleep 20
      done
   else
      #run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-single
      pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=dev --cluster=dev-cluster --replication-set=repl1 ms-single-${SERVICE_RANDOM_NUMBER} 127.0.0.1:$node_port
   fi
else
     dbdeployer deploy multiple ${db_version_sandbox} --sandbox-binary=~/ms${ms_version} --nodes $number_of_nodes --force --remote-access=% --bind-address=0.0.0.0 ${my_cnf_options:+--my-cnf-options="$my_cnf_options"}
     export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
     node_port=`dbdeployer sandboxes --header | grep ${db_version_sandbox} | grep 'multiple' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
     mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
     mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'GRgrO9301RuF';"
     mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL innodb_monitor_enable=all;"
     mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE '%statements%';"
     for j in `seq 1  $number_of_nodes`; do
        if [[ "${query_source}" == "slowlog" ]]; then
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL slow_query_log='ON';"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL long_query_time=0;"
      	   mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_admin_statements=ON;"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_slave_statements=ON;"
        fi
        if [ $(( ${j} % 2 )) -eq 0 ]; then
          pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ms-prod --cluster=ms-prod-cluster --replication-set=ms-repl2 ms-multiple-node-$j-${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:$node_port
        else
          pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ms-dev --cluster=ms-dev-cluster --replication-set=ms-repl1 ms-multiple-node-$j-${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:$node_port
        fi
        #run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-multiple-node
        node_port=$(($node_port + 1))
        sleep 20
    done
fi

## Start Running Load
~/sandboxes/${db_sandbox}/sysbench_ready prepare > sysbench_prepare.txt 2>&1 &
sleep 120
~/sandboxes/${db_sandbox}/sysbench_ready run > sysbench_run.txt 2>&1 &
