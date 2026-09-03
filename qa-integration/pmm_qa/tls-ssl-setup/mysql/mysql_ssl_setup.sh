#!/bin/bash


while [ $# -gt 0 ]; do

   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi

  shift
done

if [ -z "$mysql_version" ]
then
      export mysql_version=8.0
fi

# Percona Server 9.7 is systemd-only (no /etc/init.d/mysql, no mysqld_safe) and
# this container has no systemd, so start mysqld directly instead of via service.
restart_mysql() {
  if [ "$mysql_version" == "9.7" ]; then
    mysqladmin shutdown 2>/dev/null || pkill -x mysqld 2>/dev/null || true
    for _ in $(seq 30); do pgrep -x mysqld >/dev/null || break; sleep 1; done
    mkdir -p /var/run/mysqld
    chown mysql:mysql /var/run/mysqld
    mysqld --user=mysql --daemonize
  else
    service mysql restart
  fi
}

apt-get update
apt-get -y install wget curl git gnupg2 lsb-release
wget https://repo.percona.com/apt/percona-release_latest.generic_all.deb
dpkg -i percona-release_latest.generic_all.deb
sleep 10
if [ "$mysql_version" == "8.0" ]; then
    percona-release setup ps80
    sleep 10
    DEBIAN_FRONTEND=noninteractive apt-get -y install percona-server-server sysbench bc screen
cat > /etc/mysql/my.cnf << EOF
[mysqld]
innodb_buffer_pool_size=256M
innodb_buffer_pool_instances=1
innodb_log_file_size=1G
innodb_flush_method=O_DIRECT
innodb_numa_interleave=1
innodb_flush_neighbors=0
log_bin
server_id=1
binlog_expire_logs_seconds=600
log_output=file
slow_query_log=ON
long_query_time=0
log_slow_rate_limit=1
log_slow_rate_type=query
log_slow_verbosity=full
log_slow_admin_statements=ON
log_slow_slave_statements=ON
slow_query_log_always_write_time=1
slow_query_log_use_global_control=all
innodb_monitor_enable=all
userstat=1
bind-address=0.0.0.0
require_secure_transport=ON
EOF

fi

if [ "$mysql_version" == "8.4" ] || [ "$mysql_version" == "9.7" ]; then
    case "$mysql_version" in
      8.4) repo=ps-84-lts; redo_log=innodb_log_file_size=1G ;;
      9.7) repo=ps-97-lts; redo_log=innodb_redo_log_capacity=1G ;;
    esac
    percona-release enable "$repo" release
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get -y install percona-server-server sysbench bc screen
cat > /etc/mysql/my.cnf << EOF
[mysqld]
innodb_buffer_pool_size=256M
innodb_buffer_pool_instances=1
$redo_log
innodb_flush_method=O_DIRECT
innodb_numa_interleave=1
innodb_flush_neighbors=0
log_bin
server_id=1
binlog_expire_logs_seconds=600
log_output=file
slow_query_log=ON
long_query_time=0
log_slow_rate_limit=1
log_slow_rate_type=query
log_slow_verbosity=full
log_slow_admin_statements=ON
log_slow_replica_statements=ON
slow_query_log_always_write_time=1
slow_query_log_use_global_control=all
innodb_monitor_enable=all
userstat=1
bind-address=0.0.0.0
require_secure_transport=ON
EOF

fi

if [ "$mysql_version" == "5.7" ]; then
    percona-release setup ps57
    sleep 10
    DEBIAN_FRONTEND=noninteractive apt-get -y install percona-server-server-5.7 
cat > /etc/mysql/my.cnf << EOF
[mysqld]
innodb_buffer_pool_size=256M
innodb_buffer_pool_instances=1
innodb_log_file_size=1G
innodb_flush_method=O_DIRECT
innodb_numa_interleave=1
innodb_flush_neighbors=0
log_bin
server_id=1
expire_logs_days=1
log_output=file
slow_query_log=ON
long_query_time=0
log_slow_rate_limit=1
log_slow_rate_type=query
log_slow_verbosity=full
log_slow_admin_statements=ON
log_slow_slave_statements=ON
slow_query_log_always_write_time=1
slow_query_log_use_global_control=all
innodb_monitor_enable=all
userstat=1
bind-address=0.0.0.0
require_secure_transport=ON
EOF

fi
restart_mysql
mysql -e "create user pmm@'%' identified by \"pmm\""
mysql -e "grant all on *.* to pmm@'%'"
mysql -e "CREATE USER 'pmm_tls'@'%' REQUIRE X509"
restart_mysql
