#!/bin/bash
sudo yum install -y socat
wget https://raw.githubusercontent.com/Percona-QA/percona-qa/master/pxc-tests/pxc-startup.sh
sed -i 's+wsrep_node_incoming_address=$ADDR+wsrep_node_incoming_address=$ADDR:$RBASE1+g' pxc-startup.sh
wget https://www.percona.com/downloads/Percona-XtraDB-Cluster-80/Percona-XtraDB-Cluster-8.0.18-9.1.rc/binary/tarball/Percona-XtraDB-Cluster_8.0.18.9_Linux.x86_64.el7.tar.gz
tar -xzf Percona-XtraDB-Cluster*
rm -r Percona-XtraDB-Cluster*.tar.gz
cd Percona-XtraDB-Cluster*
bash ../pxc-startup.sh
export number_of_nodes=$1
./start_pxc $number_of_nodes
touch sysbench_run_node1.txt


## Install proxysql2
sudo yum install -y proxysql2

### enable slow log 
for j in `seq 1  ${number_of_nodes}`;
do
	bin/mysql -A -uroot -Snode$j/socket.sock -e "SET GLOBAL slow_query_log='ON';"
	bin/mysql -A -uroot -Snode$j/socket.sock -e "SET GLOBAL long_query_time=0;"
	bin/mysql -A -uroot -Snode$j/socket.sock -e "SET GLOBAL log_slow_rate_limit=1;"
done

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
sysbench /usr/share/sysbench/oltp_insert.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=node1/socket.sock --mysql-password=test --db-driver=mysql --threads=5 --tables=10 --table-size=1000 prepare > sysbench_run_node1.txt 2>&1 &
sysbench /usr/share/sysbench/oltp_read_only.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=node1/socket.sock --mysql-password=test --db-driver=mysql --threads=5 --tables=10 --table-size=1000 --time=600 run > sysbench_run_node1.txt 2>&1 &
sysbench /usr/share/sysbench/oltp_read_write.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=node1/socket.sock --mysql-password=test --db-driver=mysql --threads=5 --tables=10 --table-size=1000 --time=600 run > sysbench_run_node1.txt 2>&1 &