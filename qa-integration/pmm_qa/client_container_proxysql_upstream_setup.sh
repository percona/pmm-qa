#!/bin/bash
# Configure upstream ProxySQL for a PXC cluster via its admin interface (6032):
# Percona's proxysql-admin, which does this on the 5.7/8.0 path, is not shipped
# with upstream ProxySQL. admin-stats_credentials is set for read_user because
# the CLI tests add the ProxySQL service as that user.
#
# The hostgroup layout reproduces what proxysql-admin --enable builds on the
# 5.7/8.0 path, so both paths front the cluster the same way and the ProxySQL
# Instance Summary dashboard keeps its writer/reader split: measured on a live
# 8.0 cluster, runtime_mysql_galera_hostgroups there is exactly
# (10, 12, 11, 13, active=1, max_writers=1, writer_is_also_reader=2,
# max_transactions_behind=100). Servers are seeded into the writer hostgroup;
# ProxySQL's own Galera monitor then distributes them across reader and
# backup-writer.

set -euo pipefail

number_of_nodes=${1:-3}

for _ in $(seq 1 30); do
  mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "SELECT 1" >/dev/null 2>&1 && break
  sleep 2
done

writer_hostgroup=10
reader_hostgroup=11
backup_writer_hostgroup=12
offline_hostgroup=13

servers=""
for j in $(seq 1 "${number_of_nodes}"); do
  port=$(grep '^port=' /home/pxc/PXC/node"$j".cnf | cut -d= -f2 | tr -d ' ')
  servers="${servers:+$servers,}(${writer_hostgroup},'127.0.0.1',$port)"
done

mysql -h127.0.0.1 -P6032 -uadmin -padmin <<SQL
DELETE FROM mysql_servers;
INSERT INTO mysql_servers (hostgroup_id, hostname, port) VALUES $servers;

DELETE FROM mysql_galera_hostgroups;
INSERT INTO mysql_galera_hostgroups
  (writer_hostgroup, backup_writer_hostgroup, reader_hostgroup, offline_hostgroup,
   active, max_writers, writer_is_also_reader, max_transactions_behind)
VALUES
  ($writer_hostgroup, $backup_writer_hostgroup, $reader_hostgroup, $offline_hostgroup,
   1, 1, 2, 100);

LOAD MYSQL SERVERS TO RUNTIME;
SAVE MYSQL SERVERS TO DISK;

UPDATE global_variables SET variable_value='monitor' WHERE variable_name IN ('mysql-monitor_username','mysql-monitor_password');
LOAD MYSQL VARIABLES TO RUNTIME;
SAVE MYSQL VARIABLES TO DISK;

UPDATE global_variables SET variable_value='read_user:read_user' WHERE variable_name='admin-stats_credentials';
LOAD ADMIN VARIABLES TO RUNTIME;
SAVE ADMIN VARIABLES TO DISK;

DELETE FROM mysql_users;
INSERT INTO mysql_users (username, password, default_hostgroup) VALUES ('proxysql_user','passw0rd',$writer_hostgroup);
LOAD MYSQL USERS TO RUNTIME;
SAVE MYSQL USERS TO DISK;
SQL
