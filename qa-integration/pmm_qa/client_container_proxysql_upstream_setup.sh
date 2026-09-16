#!/bin/bash
# Configure upstream ProxySQL for a PXC cluster via its admin interface (6032):
# Percona's proxysql-admin, which does this on the 5.7/8.0 path, is not shipped
# with upstream ProxySQL. admin-stats_credentials is set for read_user because
# the CLI tests add the ProxySQL service as that user.

set -euo pipefail

number_of_nodes=${1:-3}

for _ in $(seq 1 30); do
  mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "SELECT 1" >/dev/null 2>&1 && break
  sleep 2
done

servers=""
for j in $(seq 1 "${number_of_nodes}"); do
  port=$(grep '^port=' /home/pxc/PXC/node"$j".cnf | cut -d= -f2 | tr -d ' ')
  servers="${servers:+$servers,}(0,'127.0.0.1',$port)"
done

mysql -h127.0.0.1 -P6032 -uadmin -padmin <<SQL
DELETE FROM mysql_servers;
INSERT INTO mysql_servers (hostgroup_id, hostname, port) VALUES $servers;
LOAD MYSQL SERVERS TO RUNTIME;
SAVE MYSQL SERVERS TO DISK;

UPDATE global_variables SET variable_value='monitor' WHERE variable_name IN ('mysql-monitor_username','mysql-monitor_password');
LOAD MYSQL VARIABLES TO RUNTIME;
SAVE MYSQL VARIABLES TO DISK;

UPDATE global_variables SET variable_value='read_user:read_user' WHERE variable_name='admin-stats_credentials';
LOAD ADMIN VARIABLES TO RUNTIME;
SAVE ADMIN VARIABLES TO DISK;

DELETE FROM mysql_users;
INSERT INTO mysql_users (username, password, default_hostgroup) VALUES ('proxysql_user','passw0rd',0);
LOAD MYSQL USERS TO RUNTIME;
SAVE MYSQL USERS TO DISK;
SQL
