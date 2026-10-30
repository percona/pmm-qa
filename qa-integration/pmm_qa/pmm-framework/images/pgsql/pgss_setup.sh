#!/bin/bash
# PGDG PostgreSQL VERSION with pg_stat_statements, the pmm user and the
# databases the tests use.
# Usage: pgss_setup.sh VERSION
set -e
version=${1:?PostgreSQL major version}
conf=/etc/postgresql/$version/main

# Created before the package so postgres keeps /home/postgres as its home.
mkdir -p /home/postgres
useradd postgres
chown -R postgres:postgres /home/postgres

apt-get update
apt-get -y install wget curl gnupg2 lsb-release
# support_scripts/upgrade_clients.sh upgrades pmm-client through percona-release.
curl -fsSL --retry 5 -o /tmp/percona-release.deb https://repo.percona.com/apt/percona-release_latest.generic_all.deb
apt-get -y install /tmp/percona-release.deb
rm /tmp/percona-release.deb
for attempt in 1 2 3; do
  if wget --timeout=30 --tries=2 -O /tmp/pgdg.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc &&
    grep -q 'BEGIN PGP PUBLIC KEY BLOCK' /tmp/pgdg.asc; then
    break
  fi
  if [ "$attempt" = 3 ]; then
    echo "Failed to download the PGDG signing key after 3 attempts" >&2
    exit 1
  fi
  sleep 15
done
apt-key add /tmp/pgdg.asc
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" >/etc/apt/sources.list.d/pgdg.list
apt-get update
apt-get -y install "postgresql-$version" "postgresql-contrib-$version"

service postgresql stop
sed -i -e 's/\(host\s*all\s*all\s*127.0.0.1.*\) md5/\1 trust/g' \
  -e 's/\(host\s*all\s*all\s*::1.*\) md5/\1 trust/g' \
  -e 's/\(local\s*all\s*postgres.*\) peer/\1 trust/g' \
  -e 's/\(local\s*all\s*all.*\) peer/\1 trust/g' "$conf/pg_hba.conf"
echo "host    all             all              0.0.0.0/0                       md5" >>"$conf/pg_hba.conf"
sed -i "s/#listen_addresses.*/listen_addresses = '*'/g" "$conf/postgresql.conf"
cat >>"$conf/postgresql.conf" <<'EOF'
shared_preload_libraries = 'pg_stat_statements'
track_activity_query_size=2048
track_io_timing=ON
pg_stat_statements.track=all
EOF
chown -R postgres:postgres "/var/lib/postgresql/$version/main"
chmod 0700 -R "/var/lib/postgresql/$version/main"

cat >/home/postgres/init.sql <<'EOF'
CREATE DATABASE sbtest1;
CREATE DATABASE sbtest2;
CREATE USER pmm WITH PASSWORD 'pmm';
GRANT pg_monitor TO pmm;
ALTER USER postgres PASSWORD 'pass+this';
ALTER SYSTEM SET max_locks_per_transaction = 1024;
CREATE DATABASE contrib_regression;
-- pg_stat_user_tables_* only has rows while a user table exists; keep one, analyzed.
CREATE TABLE IF NOT EXISTS pmm_qa_stat_user_tables_seed (id serial PRIMARY KEY, note text);
INSERT INTO pmm_qa_stat_user_tables_seed (note) VALUES ('pmm-qa seed');
ANALYZE pmm_qa_stat_user_tables_seed;
EOF
service postgresql start
su postgres bash -c 'psql -v ON_ERROR_STOP=1 -f /home/postgres/init.sql'
su postgres bash -c 'psql -c "CREATE EXTENSION pg_stat_statements;"'
