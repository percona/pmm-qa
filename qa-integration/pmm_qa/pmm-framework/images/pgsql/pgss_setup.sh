#!/bin/bash
# Community PostgreSQL VERSION from PGDG with pg_stat_statements, the pmm and
# repl_user users and the databases the tests use, ready for systemd to start.
# Usage: pgss_setup.sh VERSION
set -eu
version=${1:?PostgreSQL major version}
data=/var/lib/pgsql/$version/data

# percona-release: support_scripts/upgrade_clients.sh upgrades pmm-client through it.
dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm \
  "https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-$(uname -m)/pgdg-redhat-repo-latest.noarch.rpm"
# Oracle Linux leaves $releasever_minor empty, so PGDG's repo uses its major-only rhel-9 paths.
# shellcheck disable=SC2016 # dnf's variables, not the shell's
sed -i 's/\$releasever_major\.\$releasever_minor/$releasever_major/' /etc/yum.repos.d/pgdg-redhat-all.repo
dnf install -y "postgresql$version-server" "postgresql$version-contrib" \
  systemd sudo initscripts-service iproute procps-ng findutils gzip tar wget
dnf clean all
rm -rf /var/cache/dnf

su postgres -c "initdb -D $data -E UTF8 --locale=C.UTF-8"
cat >"$data/pg_hba.conf" <<'EOF'
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
host    replication     repl_user       0.0.0.0/0               md5
host    all             all             0.0.0.0/0               md5
EOF
cat >>"$data/postgresql.conf" <<'EOF'
listen_addresses = '*'
shared_preload_libraries = 'pg_stat_statements'
track_activity_query_size=2048
track_io_timing=ON
pg_stat_statements.track=all
wal_keep_size = 64MB
EOF

su postgres -c "pg_ctl -D $data -w start"
su postgres -c 'psql -v ON_ERROR_STOP=1' <<'EOF'
CREATE DATABASE sbtest1;
CREATE DATABASE sbtest2;
CREATE USER pmm WITH PASSWORD 'pmm';
GRANT pg_monitor TO pmm;
ALTER USER postgres PASSWORD 'pass+this';
ALTER SYSTEM SET max_locks_per_transaction = 1024;
CREATE DATABASE contrib_regression;
CREATE EXTENSION pg_stat_statements;
-- pg_stat_user_tables_* only has rows while a user table exists; keep one, analyzed.
CREATE TABLE IF NOT EXISTS pmm_qa_stat_user_tables_seed (id serial PRIMARY KEY, note text);
INSERT INTO pmm_qa_stat_user_tables_seed (note) VALUES ('pmm-qa seed');
ANALYZE pmm_qa_stat_user_tables_seed;
EOF
su postgres -c "pg_ctl -D $data -w stop"

ln -s "/usr/lib/systemd/system/postgresql-$version.service" /etc/systemd/system/postgresql.service
systemctl enable "postgresql-$version"
