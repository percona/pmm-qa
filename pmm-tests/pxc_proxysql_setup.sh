#!/bin/bash
export number_of_nodes=$1
export pxc_version=$2
export query_source=$3

sudo yum install -y socat
wget https://raw.githubusercontent.com/Percona-QA/percona-qa/master/pxc-tests/pxc-startup.sh
sed -i 's/log-output=none/log-output=file/g' pxc-startup.sh
## bug https://bugs.mysql.com/bug.php?id=90553 workaround
sed -i 's+${MID} --datadir+${MID} --socket=\\${node}/socket.sock --port=\\${RBASE1} --datadir+g' pxc-startup.sh

## Download right PXC version
if [ "$pxc_version" == "5.7" ]; then
	wget https://downloads.percona.com/downloads/Percona-XtraDB-Cluster-57/Percona-XtraDB-Cluster-5.7.34-31.51/binary/tarball/Percona-XtraDB-Cluster-5.7.34-rel37-51.1.Linux.x86_64.glibc2.12-minimal.tar.gz
	sudo yum install -y percona-xtrabackup-24
fi
if [ "$pxc_version" == "8.0" ]; then
	sed -i 's+wsrep_node_incoming_address=$ADDR+wsrep_node_incoming_address=$ADDR:$RBASE1+g' pxc-startup.sh
	wget https://downloads.percona.com/downloads/Percona-XtraDB-Cluster-LATEST/Percona-XtraDB-Cluster-8.0.27/binary/tarball/Percona-XtraDB-Cluster_8.0.27-18.1_Linux.x86_64.glibc2.17-minimal.tar.gz	
fi
tar -xzf Percona-XtraDB-Cluster*
rm -r Percona-XtraDB-Cluster*.tar.gz
mv Percona-XtraDB-Cluster* PXC
cd PXC

## start PXC
bash ../pxc-startup.sh
bash ./start_pxc $number_of_nodes
touch sysbench_run_node1_prepare.txt
touch sysbench_run_node1_read_write.txt
touch sysbench_run_node1_read_only.txt

## Install proxysql2
sudo yum install -y proxysql2

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

### update proxysql configuration use, correct port
export node1_port=$(cat node1.cnf | grep port | awk -F"=" '{print $2}')
sudo sed -i "s/3306/${node1_port}/" /etc/proxysql-admin.cnf

sudo service proxysql start
sleep 20
sudo proxysql-admin -e

## Start Running Load
#sysbench /usr/share/sysbench/oltp_insert.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=node1/socket.sock --mysql-password=test --db-driver=mysql --threads=5 --tables=10 --table-size=1000 prepare > sysbench_run_node1_prepare.txt 2>&1 &
#sleep 20
#sysbench /usr/share/sysbench/oltp_read_only.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=node1/socket.sock --mysql-password=test --db-driver=mysql --threads=5 --tables=10 --table-size=1000 --time=12000 run > sysbench_run_node1_read_only.txt 2>&1 &
#sysbench /usr/share/sysbench/oltp_read_write.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=node1/socket.sock --mysql-password=test --db-driver=mysql --threads=5 --tables=10 --table-size=1000 --time=12000 run > sysbench_run_node1_read_write.txt 2>&1 &
