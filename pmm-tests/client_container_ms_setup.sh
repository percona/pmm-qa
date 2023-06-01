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
      export ms_version="8.0.33"
fi

if [ -z "$ms_tarball" ]
then
      export ms_tarball="https://dev.mysql.com/get/Downloads/MySQL-8/mysql-8.0.33-linux-glibc2.28-x86_64.tar.gz"
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

## Deploy DB deployer
export tar_ball_name=$(ls mysql-*)
dbdeployer unpack ${tar_ball_name} --sandbox-binary=~/ms${ms_version} --overwrite
export db_version_sandbox=$(ls ~/ms${ms_version})

if [[ $number_of_nodes == 1 ]];then
   if [[ ! -z $group_replication ]]; then
      dbdeployer deploy --topology=group replication ${db_version_sandbox} --single-primary --sandbox-binary=~/ms${ms_version} --remote-access=% --bind-address=0.0.0.0 --force
      export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
      node_port=`dbdeployer sandboxes --header | grep ${db_version_sandbox} | grep 'group-single-primary' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
   else
      dbdeployer deploy single ${db_version_sandbox} --sandbox-binary=~/ms${ms_version} --remote-access=% --bind-address=0.0.0.0 --force
      export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
      node_port=`dbdeployer sandboxes --header | grep  ${db_version_sandbox} | grep 'single' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
      mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
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
        #run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-group-replication-node-$j
        pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ms-prod --cluster=ms-prod-cluster --replication-set=ms-repl ms-group-replication-node-$j --debug 127.0.0.1:$node_port
        node_port=$(($node_port + 1))
        sleep 20
      done
   else
      #run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-single-$IP_ADDRESS
      pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=dev --cluster=dev-cluster --replication-set=repl1 ms-single 127.0.0.1:$node_port
   fi
else
     dbdeployer deploy multiple ${db_version_sandbox} --sandbox-binary=~/ms${ms_version} --nodes $number_of_nodes --force --remote-access=% --bind-address=0.0.0.0
     export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
     node_port=`dbdeployer sandboxes --header | grep ${db_version_sandbox} | grep 'multiple' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
     for j in `seq 1  $number_of_nodes`; do
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
        if [[ "${query_source}" == "slowlog" ]]; then
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL slow_query_log='ON';"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL long_query_time=0;"
      	   mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_admin_statements=ON;"
           mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_slave_statements=ON;"
        fi
        if [ $(( ${j} % 2 )) -eq 0 ]; then
          pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ms-prod --cluster=ms-prod-cluster --replication-set=ms-repl2 ms-multiple-node-$j --debug 127.0.0.1:$node_port
        else
          pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ms-dev --cluster=ms-dev-cluster --replication-set=ms-repl1 ms-multiple-node-$j --debug 127.0.0.1:$node_port
        fi
        #run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-multiple-node-$j-$IP_ADDRESS
        node_port=$(($node_port + 1))
        sleep 20
    done
fi

## Start Running Load
~/sandboxes/${db_sandbox}/sysbench_ready prepare > sysbench_prepare.txt 2>&1 &
sleep 120
~/sandboxes/${db_sandbox}/sysbench_ready run > sysbench_run.txt 2>&1 &
