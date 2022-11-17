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
      export ps_version=8
fi

if [ -z "$ps_tarball" ]
then
      export ps_tarball=https://downloads.percona.com/downloads/Percona-Server-LATEST/Percona-Server-8.0.29-21/binary/tarball/Percona-Server-8.0.29-21-Linux.x86_64.glibc2.17-minimal.tar.gz
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

## Deploy DB deployer
export tar_ball_name=$(ls Percona-Server*)
dbdeployer unpack ${tar_ball_name} --sandbox-binary=~/ps${ps_version} --flavor=percona  
export db_version_sandbox=$(ls ~/ps${ps_version})
dbdeployer deploy single ${db_version_sandbox} --port=${PS_PORT} --sandbox-binary=~/ps${ps_version} --remote-access=% --bind-address=0.0.0.0

export db_sandbox=$(dbdeployer sandboxes | awk -F' ' '{print $1}')
export SERVICE_RANDOM_NUMBER=$((1 + $RANDOM % 9999))
if [ "$query_source" == "slowlog" ]; then
    ### enable Slow log
    mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL slow_query_log='ON';"
    mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL long_query_time=0;"
    mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL log_slow_rate_limit=1;"
    mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL log_slow_admin_statements=ON;"
    mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL log_slow_slave_statements=ON;"
    pmm-admin add mysql --username=${PS_USER} --password=${PS_PASSWORD} --port=3307 --query-source=slowlog mysql_client_slowlog_${SERVICE_RANDOM_NUMBER}
else
    mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL innodb_monitor_enable=all;"
    if echo "$ps_version" | grep '5.7'; then
       mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_AUDIT SONAME 'query_response_time.so';"
       mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME SONAME 'query_response_time.so';"
       mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_READ SONAME 'query_response_time.so';"
       mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_WRITE SONAME 'query_response_time.so';"
       mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL query_response_time_stats=ON;"
    fi
    mysql -h 127.0.0.1 -u ${PS_USER} -p${PS_PASSWORD} --port $PS_PORT -e "UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE '%statements%';"
    pmm-admin add mysql --username=${PS_USER} --password=${PS_PASSWORD} --port=3307 --query-source=perfschema mysql_client_perfschema_${SERVICE_RANDOM_NUMBER}
fi

## Start Running Load
~/sandboxes/${db_sandbox}/sysbench_ready prepare > sysbench_prepare.txt 2>&1 &
sleep 120
~/sandboxes/${db_sandbox}/sysbench_ready run > sysbench_run.txt 2>&1 &
