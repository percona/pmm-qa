#!/bin/bash

export number_of_nodes=3
export pxc_version=8
export pxc_dev_cluster=pxc-dev-cluster

mysql -u admin -padmin -h 127.0.0.1 -P 6032  -e "DELETE FROM mysql_users WHERE username='sysbench';"
mysql -u admin -padmin -h 127.0.0.1 -P 6032  -e "INSERT INTO mysql_users(username,password,default_hostgroup) VALUES ('sysbench','test',10); LOAD MYSQL USERS TO RUNTIME; SAVE MYSQL USERS TO DISK;"

export SERVICE_RANDOM_NUMBER=$((1 + $RANDOM % 9999))
for j in `seq 1  ${number_of_nodes}`;do
    pmm-admin add mysql --query-source=slowlog --username=sysbench --password=test --host=127.0.0.1 --port=$(cat /home/pxc/PXC/node$j.cnf | grep port | awk -F"=" '{print $2}') --environment=pxc-dev --cluster=${pxc_dev_cluster} --replication-set=pxc-repl pxc_node__${j}_${SERVICE_RANDOM_NUMBER}
done

export SERVICE_RANDOM_NUMBER=$((1 + $RANDOM % 9999))
for j in `seq 1  ${number_of_nodes}`;do
    pmm-admin add mysql --query-source=perfschema --username=sysbench --password=test --host=127.0.0.1 --port=$(cat /home/pxc/PXC/node$j.cnf | grep port | awk -F"=" '{print $2}') --environment=pxc-dev --cluster=${pxc_dev_cluster} --replication-set=pxc-repl pxc_node__${j}_${SERVICE_RANDOM_NUMBER}
done

## Start Running Load
sysbench /usr/share/sysbench/oltp_insert.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=/home/pxc/PXC/node1/socket.sock --mysql-password=test --db-driver=mysql --threads=1 --tables=10 --table-size=1000 prepare > sysbench_run_node1_prepare.txt 2>&1 &
sleep 20
sysbench /usr/share/sysbench/oltp_read_only.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=/home/pxc/PXC/node1/socket.sock --mysql-password=test --db-driver=mysql --threads=1 --tables=10 --table-size=1000 --time=12000 run > sysbench_run_node1_read_only.txt 2>&1 &
sysbench /usr/share/sysbench/oltp_read_write.lua --mysql-db=sbtest --mysql-user=sysbench --mysql-socket=/home/pxc/PXC/node1/socket.sock --mysql-password=test --db-driver=mysql --threads=1 --tables=10 --table-size=1000 --time=0 run > sysbench_run_node1_read_write.txt 2>&1 &

