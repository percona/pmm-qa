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

if [ -z "$pxc_version" ]
then
      export pxc_version=8
fi

if [ -z "$pxc_tarball" ]
then
      export pxc_tarball=https://downloads.percona.com/downloads/Percona-XtraDB-Cluster-LATEST/Percona-XtraDB-Cluster-8.0.29/binary/tarball/Percona-XtraDB-Cluster_8.0.29-21.1_Linux.x86_64.glibc2.17-minimal.tar.gz
fi

if [ -z "$query_source" ]
then
      export query_source=perfschema
fi

whoami
cd ~
wget https://raw.githubusercontent.com/Percona-QA/percona-qa/master/pxc-tests/pxc-startup.sh
sed -i 's/log-output=none/log-output=file/g' pxc-startup.sh
## bug https://bugs.mysql.com/bug.php?id=90553 workaround
sed -i 's+${MID} --datadir+${MID} --socket=\\${node}/socket.sock --port=\\${RBASE1} --datadir+g' pxc-startup.sh

## Download right PXC version
if echo "$pxc_version" | grep '8'; then
  sed -i 's+wsrep_node_incoming_address=$ADDR+wsrep_node_incoming_address=$ADDR:$RBASE1+g' pxc-startup.sh
fi

wget -O Percona-XtraDB-Cluster.tar.gz ${pxc_tarball}
tar -xzf Percona-XtraDB-Cluster.tar.gz
rm -r Percona-XtraDB-Cluster.tar.gz
mv Percona-XtraDB-Cluster* PXC
cd PXC

## start PXC
bash ../pxc-startup.sh
bash ./start_pxc $number_of_nodes
touch sysbench_run_node1_prepare.txt
touch sysbench_run_node1_read_write.txt
touch sysbench_run_node1_read_only.txt

### enable slow log
if [ "$query_source" == "slowlog" ]; then
  for j in `seq 1  ${number_of_nodes}`;
  do
    bin/mysql -A -uroot -Snode$j/socket.sock -e "SET GLOBAL slow_query_log='ON';"
    bin/mysql -A -uroot -Snode$j/socket.sock -e "SET GLOBAL long_query_time=0;"
    bin/mysql -A -uroot -Snode$j/socket.sock -e "SET GLOBAL log_slow_rate_limit=1;"
    bin/mysql -A -uroot -Snode$j/socket.sock -e "SET GLOBAL log_slow_verbosity='full';"
    bin/mysql -A -uroot -Snode$j/socket.sock -e "SET GLOBAL log_slow_rate_type='query';"
  done
fi

bin/mysql -A -uroot -Snode1/socket.sock -e "create user admin@localhost identified with mysql_native_password by 'admin';"
bin/mysql -A -uroot -Snode1/socket.sock -e "grant all on *.* to admin@localhost;"
bin/mysql -A -uroot -Snode1/socket.sock -e "create user sysbench@'%' identified with  mysql_native_password by 'test';"
bin/mysql -A -uroot -Snode1/socket.sock -e "grant all on *.* to sysbench@'%';"
bin/mysql -A -uroot -Snode1/socket.sock -e "drop database if exists sbtest;create database sbtest;"


export SERVICE_RANDOM_NUMBER=$((1 + $RANDOM % 9999))
for j in `seq 1  ${number_of_nodes}`;do
    pmm-admin add mysql --query-source=perfschema --username=sysbench --password=test --host=127.0.0.1 --port=$(cat node$j.cnf | grep port | awk -F"=" '{print $2}') --environment=pxc-dev --cluster=pxc-dev-cluster --replication-set=pxc-repl pxc_node__${j}_${SERVICE_RANDOM_NUMBER}
done

## Start Running Load
sysbench /usr/share/sysbench/oltp_insert.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=/home/pxc/PXC/node1/socket.sock --mysql-password=test --db-driver=mysql --threads=1 --tables=10 --table-size=1000 prepare > sysbench_run_node1_prepare.txt 2>&1 &
sleep 20
sysbench /usr/share/sysbench/oltp_read_only.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=/home/pxc/PXC/node1/socket.sock --mysql-password=test --db-driver=mysql --threads=1 --tables=10 --table-size=1000 --time=12000 run > sysbench_run_node1_read_only.txt 2>&1 &
sysbench /usr/share/sysbench/oltp_read_write.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=/home/pxc/PXC/node1/socket.sock --mysql-password=test --db-driver=mysql --threads=1 --tables=10 --table-size=1000 --time=0 run > sysbench_run_node1_read_write.txt 2>&1 &
