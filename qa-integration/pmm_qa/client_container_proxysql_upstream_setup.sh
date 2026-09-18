#!/bin/bash
# Configure upstream ProxySQL for a PXC cluster via its admin interface (6032):
# Percona's proxysql-admin, which does this on the 5.7/8.0 path, is not shipped
# with upstream ProxySQL. admin-stats_credentials is set for read_user because
# the CLI tests add the ProxySQL service as that user.
#
# The nodes go into a galera hostgroup set rather than one flat hostgroup, which
# is what proxysql-admin --enable builds on the other path: without it ProxySQL
# does no writer/reader routing, and the ProxySQL dashboards -- whose hostgroup
# variable is label_values(proxysql_connection_pool_status, hostgroup) -- see a
# single value instead of writer, reader and backup-writer.

set -euo pipefail

number_of_nodes=${1:-3}

# Same numbering proxysql-admin uses for a galera cluster.
WRITER_HOSTGROUP=10
READER_HOSTGROUP=11
BACKUP_WRITER_HOSTGROUP=12
OFFLINE_HOSTGROUP=13

for _ in $(seq 1 30); do
  mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "SELECT 1" >/dev/null 2>&1 && break
  sleep 2
done

servers=""
for j in $(seq 1 "${number_of_nodes}"); do
  port=$(grep '^port=' /home/pxc/PXC/node"$j".cnf | cut -d= -f2 | tr -d ' ')
  servers="${servers:+$servers,}($WRITER_HOSTGROUP,'127.0.0.1',$port)"
done

mysql -h127.0.0.1 -P6032 -uadmin -padmin <<SQL
UPDATE global_variables SET variable_value='monitor' WHERE variable_name IN ('mysql-monitor_username','mysql-monitor_password');
LOAD MYSQL VARIABLES TO RUNTIME;
SAVE MYSQL VARIABLES TO DISK;

DELETE FROM mysql_servers;
INSERT INTO mysql_servers (hostgroup_id, hostname, port) VALUES $servers;
DELETE FROM mysql_galera_hostgroups;
INSERT INTO mysql_galera_hostgroups
  (writer_hostgroup, backup_writer_hostgroup, reader_hostgroup, offline_hostgroup,
   active, max_writers, writer_is_also_reader, max_transactions_behind)
  VALUES ($WRITER_HOSTGROUP, $BACKUP_WRITER_HOSTGROUP, $READER_HOSTGROUP, $OFFLINE_HOSTGROUP,
          1, 1, 1, 100);
LOAD MYSQL SERVERS TO RUNTIME;
SAVE MYSQL SERVERS TO DISK;

UPDATE global_variables SET variable_value='read_user:read_user' WHERE variable_name='admin-stats_credentials';
LOAD ADMIN VARIABLES TO RUNTIME;
SAVE ADMIN VARIABLES TO DISK;

DELETE FROM mysql_users;
INSERT INTO mysql_users (username, password, default_hostgroup) VALUES ('proxysql_user','passw0rd',$WRITER_HOSTGROUP);
LOAD MYSQL USERS TO RUNTIME;
SAVE MYSQL USERS TO DISK;
SQL
