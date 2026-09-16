#!/bin/bash
# Configure upstream ProxySQL for a PXC cluster via the admin interface (6032).
# Percona's proxysql-admin is not shipped with upstream ProxySQL, so this does
# the equivalent minimum: register every PXC node in one hostgroup, set the
# monitor credentials, add the application user that sysbench routes through, and
# grant read_user read-only access to the admin interface (proxysql-admin used to
# do this via admin-stats_credentials, and the CLI tests rely on it).

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
