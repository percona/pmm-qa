#!/bin/bash

mysql -A -uroot -S /home/pxc/PXC/node1/socket.sock -e "drop database if exists sbtest;create database sbtest;"
mysql -A -uroot -S /home/pxc/PXC/node1/socket.sock -e "GRANT ALL PRIVILEGES ON sbtest.* TO 'proxysql_user'@'127.%';"

## Start Running Load
sysbench /usr/share/sysbench/oltp_insert.lua --mysql-db=sbtest --mysql-user=proxysql_user --mysql-host=127.0.0.1 --mysql-port=6033 --mysql-password=passw0rd --db-driver=mysql --threads=1 --tables=10 --table-size=1000 prepare > sysbench_run_node1_prepare.txt 2>&1 &
sleep 20
sysbench /usr/share/sysbench/oltp_read_only.lua --mysql-db=sbtest --mysql-user=proxysql_user --mysql-host=127.0.0.1 --mysql-port=6033 --mysql-password=passw0rd --db-driver=mysql --threads=1 --tables=10 --table-size=1000 --time=12000 run > sysbench_run_node1_read_only.txt 2>&1 &
sysbench /usr/share/sysbench/oltp_read_write.lua --mysql-db=sbtest --mysql-user=proxysql_user --mysql-host=127.0.0.1 --mysql-port=6033 --mysql-password=passw0rd --db-driver=mysql --threads=1 --tables=10 --table-size=1000 --time=0 run > sysbench_run_node1_read_write.txt 2>&1 &
