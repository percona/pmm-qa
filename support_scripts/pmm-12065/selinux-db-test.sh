#!/usr/bin/env bash
# PMM-12065: exercise the database-monitoring path (postgres_exporter + QAN)
# inside the SELinux-enforcing guest, where SELinux most plausibly interferes:
# the exporter must reach PostgreSQL's unix socket and read its data directory.
set -u
KEY=/root/.ssh/qemu_guest
G="ssh -i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15 -p 2222 rocky@127.0.0.1"

echo "### install and start PostgreSQL under SELinux enforcing"
$G 'sudo dnf install -y -q postgresql-server postgresql-contrib 2>&1 | tail -2
    sudo postgresql-setup --initdb 2>&1 | tail -2
    echo "shared_preload_libraries = '"'"'pg_stat_statements'"'"'" | sudo tee -a /var/lib/pgsql/data/postgresql.conf >/dev/null
    sudo systemctl enable --now postgresql
    sleep 5; systemctl is-active postgresql; getenforce'

echo
echo "### postgres data dir label + postgres domain"
$G 'ls -Zd /var/lib/pgsql/data; for p in $(pgrep -x postgres | head -1); do cat /proc/$p/attr/current | tr -d "\0"; echo; done'

echo
echo "### create the PMM monitoring user"
$G "sudo -u postgres psql -qc \"CREATE USER pmm WITH SUPERUSER ENCRYPTED PASSWORD 'pmmpass';\" 2>&1 | tail -2
    sudo -u postgres psql -qc 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;' 2>&1 | tail -2"

echo
echo "### add the service to PMM (postgres_exporter + QAN over the unix socket)"
$G 'sudo pmm-admin add postgresql --username=pmm --password=pmmpass --server-insecure-tls \
      --query-source=pgstatstatements pg-selinux 127.0.0.1 5432 2>&1 | tail -4'
sleep 45
echo
echo "### pmm-admin list"
$G 'sudo pmm-admin list 2>&1'
echo
echo "### exporter domains"
$G 'for p in $(pgrep -f postgres_exporter); do printf "%s %s\n" "$(cat /proc/$p/attr/current|tr -d "\0")" "$(ps -p $p -o comm=)"; done'
echo
echo "### SELinux denials after adding a monitored database"
$G 'getenforce; echo -n "avc: denied lines in audit.log: "; sudo grep -c "avc:  denied" /var/log/audit/audit.log 2>/dev/null || echo 0
    sudo ausearch -m AVC,USER_AVC,SELINUX_ERR -ts boot 2>&1 | tail -25'
echo
echo "### agent errors"
$G 'sudo journalctl -u pmm-agent --no-pager --since "-6 min" | grep -iE "denied|permission|error" | tail -8; echo "(empty = clean)"'
