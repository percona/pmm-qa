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
      export pxc_tarball=https://downloads.percona.com/downloads/Percona-XtraDB-Cluster-80/Percona-XtraDB-Cluster-8.0.32/binary/tarball/Percona-XtraDB-Cluster_8.0.32-24.1_Linux.x86_64.glibc2.34-minimal.tar.gz
fi

if [ -z "$query_source" ]
then
      export query_source=perfschema
fi

if [ -z "$pxc_dev_cluster" ]
then
      export pxc_dev_cluster=pxc-dev-cluster
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

curl ${pxc_tarball} -o Percona-XtraDB-Cluster.tar.gz
sleep 10
tar -xzf Percona-XtraDB-Cluster.tar.gz
sleep 10
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

bin/mysql -A -uroot -S/home/pxc/PXC/node1/socket.sock -e "create user 'admin'@'127.0.0.1' identified with mysql_native_password by 'admin';"
bin/mysql -A -uroot -S/home/pxc/PXC/node1/socket.sock -e "grant all on *.* to 'admin'@'127.0.0.1';"

export SERVICE_RANDOM_NUMBER=$((1 + $RANDOM % 9999))
for j in `seq 1  ${number_of_nodes}`;do
	pmm-admin add mysql --query-source=${query_source} --username=admin --password=admin --host=127.0.0.1 --port=$(cat /home/pxc/PXC/node$j.cnf | grep port | awk -F"=" '{print $2}') --environment=pxc-dev --cluster=${pxc_dev_cluster} --replication-set=pxc-repl pxc_node__${j}_${SERVICE_RANDOM_NUMBER}
done
