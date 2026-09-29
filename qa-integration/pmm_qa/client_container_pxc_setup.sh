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

if [ -z "$query_source" ]
then
      export query_source=perfschema
fi

if [ -z "$pxc_dev_cluster" ]
then
      export pxc_dev_cluster=pxc-dev-cluster
fi

whoami
cd ~ || exit 1
wget https://raw.githubusercontent.com/Percona-QA/percona-qa/master/pxc-tests/pxc-startup.sh
sed -i 's/log-output=none/log-output=file/g' pxc-startup.sh
## bug https://bugs.mysql.com/bug.php?id=90553 workaround
sed -i 's+${MID} --datadir+${MID} --socket=\\${node}/socket.sock --port=\\${RBASE1} --datadir+g' pxc-startup.sh

## Download right PXC version
if [ "$pxc_version" != "5.7" ]; then
  sed -i 's+wsrep_node_incoming_address=$ADDR+wsrep_node_incoming_address=$ADDR:$RBASE1+g' pxc-startup.sh
fi

# PXC 9.x removed wsrep_slave_threads (renamed to wsrep_applier_threads); the
# node configs pxc-startup.sh generates still use the old name, which aborts
# mysqld on 9.0+.
if [ "${pxc_version%%.*}" -ge 9 ] 2>/dev/null; then
  sed -i 's/wsrep_slave_threads/wsrep_applier_threads/g' pxc-startup.sh
fi

# Percona XtraBackup 8.x emits a timestamped log line before the version line,
# so pxc-startup.sh's version probe matches the timestamp fraction (e.g. 2.x)
# and wrongly rejects xtrabackup. Restrict the probe to the version line.
sed -i "s#xtrabackup --version 2>&1 |#& grep -i 'xtrabackup version' |#" pxc-startup.sh

# PXC is installed from packages (the playbook enabled the matching repo). Build
# a binary-tarball-shaped basedir out of symlinks into the installed files so the
# upstream pxc-startup.sh, which assumes a tarball layout, drives the cluster
# unchanged.
rm -rf ~/PXC
mkdir -p ~/PXC/bin ~/PXC/lib
ln -sf /usr/sbin/mysqld ~/PXC/bin/mysqld
ln -sf /usr/bin/mysql ~/PXC/bin/mysql
ln -sf /usr/bin/mysqladmin ~/PXC/bin/mysqladmin
for sst in /usr/bin/wsrep_sst_*; do ln -sf "$sst" ~/PXC/bin/; done
[ -e /usr/bin/pxc_extra ] && ln -sf /usr/bin/pxc_extra ~/PXC/bin/pxc_extra
ln -sf "$(ls /usr/lib/galera*/libgalera_smm.so 2>/dev/null | head -1)" ~/PXC/lib/libgalera_smm.so
ln -sf /usr/lib/mysql/plugin ~/PXC/lib/plugin
ln -sf /usr/share/mysql ~/PXC/share
if [ -f /usr/lib/percona-xtradb-cluster-testsuite/mysql-test-run.pl ]; then
  ln -sf /usr/lib/percona-xtradb-cluster-testsuite ~/PXC/mysql-test
elif [ -d /usr/share/mysql-test ]; then
  ln -sf /usr/share/mysql-test ~/PXC/mysql-test
fi
# 5.7 initialises the datadir via scripts/mysql_install_db; 8.0+ uses
# `mysqld --initialize`, so only symlink the tool when it is present.
if command -v mysql_install_db >/dev/null 2>&1; then
  mkdir -p ~/PXC/scripts
  ln -sf "$(command -v mysql_install_db)" ~/PXC/scripts/mysql_install_db
fi
# xtrabackup ships under pxc_extra rather than on PATH; pxc-startup.sh probes for
# it with `which xtrabackup`.
xtrabackup_bin="$(ls /usr/bin/pxc_extra/pxb-*/bin/xtrabackup 2>/dev/null | tail -1)"
if [ -n "$xtrabackup_bin" ]; then
  xtrabackup_dir="$(dirname "$xtrabackup_bin")"
  export PATH="$xtrabackup_dir:$PATH"
fi

cd ~/PXC || exit 1

# PXC 8.4 disabled mysql_native_password by default and Percona's proxysql-admin
# still requires it, so from 8.4 we authenticate accounts with caching_sha2_password
# and front the cluster with upstream ProxySQL (which monitors sha2 backends).
auth_plugin=mysql_native_password
proxysql_upstream=false
case "$pxc_version" in
  5.7 | 8.0) ;;
  *) auth_plugin=caching_sha2_password; proxysql_upstream=true ;;
esac

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

bin/mysql -A -uroot -S/home/pxc/PXC/node1/socket.sock -e "create user 'admin'@'%' identified with $auth_plugin by 'admin';"
bin/mysql -A -uroot -S/home/pxc/PXC/node1/socket.sock -e "create user 'read_user'@'%' identified with $auth_plugin by 'read_user';"
bin/mysql -A -uroot -S/home/pxc/PXC/node1/socket.sock -e "grant all on *.* to 'admin'@'%';"
bin/mysql -A -uroot -S/home/pxc/PXC/node1/socket.sock -e "grant select on *.* to 'read_user'@'%';"

# Upstream ProxySQL has no proxysql-admin to bootstrap its accounts, so create
# the monitor and application users here. ProxySQL connects to the backends over
# 127.0.0.1, hence the '127.%' host.
if [ "$proxysql_upstream" = true ]; then
  bin/mysql -A -uroot -S/home/pxc/PXC/node1/socket.sock -e "create user 'monitor'@'127.%' identified with $auth_plugin by 'monitor';"
  bin/mysql -A -uroot -S/home/pxc/PXC/node1/socket.sock -e "grant usage, replication client on *.* to 'monitor'@'127.%';"
  bin/mysql -A -uroot -S/home/pxc/PXC/node1/socket.sock -e "create user 'proxysql_user'@'127.%' identified with $auth_plugin by 'passw0rd';"
  bin/mysql -A -uroot -S/home/pxc/PXC/node1/socket.sock -e "grant all on *.* to 'proxysql_user'@'127.%';"
fi

export SERVICE_RANDOM_NUMBER=$((1 + $RANDOM % 9999))
for j in `seq 1  ${number_of_nodes}`;do
	pmm-admin add mysql --query-source=${query_source} --username=admin --password=admin --host=127.0.0.1 --port="$(cat /home/pxc/PXC/node$j.cnf | grep port | awk -F"=" '{print $2}')" --environment=pxc-dev --cluster=${pxc_dev_cluster} --replication-set=pxc-repl pxc_node__${j}_${SERVICE_RANDOM_NUMBER}
done
