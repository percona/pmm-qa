#!/bin/sh

while [ $# -gt 0 ]; do

   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi

  shift
done

if [ -z "$pgsql_version" ]
then
      export pgsql_version=14
fi

## Need to add a user postgres either here or in Dockerfile
cd /home
mkdir postgres
useradd postgres
chown -R postgres:postgres postgres
cd postgres

apt-get update
apt-get -y install sudo 
rm -rf /var/log/postgresql/
rm -rf /etc/postgresql/
rm -rf /usr/lib/postgresql
rm -rf /usr/include/postgresql
rm -rf /usr/share/postgresql
rm -rf /etc/postgresql
rm -f /usr/bin/pg_config
rm -rf /var/lib/postgres
apt purge postgresql-client-common postgresql-common postgresql postgresql*
apt-get update
apt-get install build-essential libreadline6-dev systemtap-sdt-dev zlib1g-dev libssl-dev libpam0g-dev python-dev bison flex libipc-run-perl git wget -y
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt/ focal-pgdg main" >> /etc/apt/sources.list.d/pgdg.list'
apt update
apt -y install postgresql-${pgsql_version} postgresql-server-dev-${pgsql_version}
sleep 10
sed -i 's/\(host\s*all\s*all\s*127.0.0.1.*\) md5/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
sed -i 's/\(host\s*all\s*all\s*::1.*\) md5/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
sed -i 's/\(local\s*all\s*postgres.*\) peer/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
sed -i 's/\(local\s*all\s*all.*\) peer/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
service postgresql restart

sleep 10
chown -R postgres:postgres /var/lib/postgresql/${pgsql_version}/main
chmod 0700 -R /var/lib/postgresql/${pgsql_version}/main
sed -i "s/#listen_addresses.*/listen_addresses = '*'/g" /etc/postgresql/${pgsql_version}/main/postgresql.conf
echo "host    all             all              0.0.0.0/0                       md5" >> /etc/postgresql/${pgsql_version}/main/pg_hba.conf

sleep 10
service postgresql restart

export PATH="/usr/lib/postgresql/${pgsql_version}/bin:$PATH"
echo $PATH
cp /usr/lib/postgresql/${pgsql_version}/bin/pg_config /usr/bin

## Down PGSM repo and move to /home/postgres/pg_stat_monitor dir
##
if [ -z "$pgstat_monitor_branch" ]
then
      export pgstat_monitor_branch=REL_1_STABLE
fi

## Down PGSM repo and move to /home/postgres/pg_stat_monitor dir
##
if [ -z "$pgstat_monitor_repo" ]
then
      export pgstat_monitor_repo=https://github.com/percona/pg_stat_monitor
fi

cd /home/postgres
git clone -b ${pgstat_monitor_branch} ${pgstat_monitor_repo}
chown -R postgres:postgres pg_stat_monitor
cd pg_stat_monitor

# Build PGSM
make USE_PGXS=1

## Install build library into server
make USE_PGXS=1 install

service postgresql stop
echo "shared_preload_libraries = 'pg_stat_monitor'" >> /etc/postgresql/${pgsql_version}/main/postgresql.conf
echo "track_activity_query_size=2048"  >> /etc/postgresql/${pgsql_version}/main/postgresql.conf
echo "track_io_timing=ON"  >> /etc/postgresql/${pgsql_version}/main/postgresql.conf

echo "CREATE DATABASE sbtest1;" >> /home/postgres/init.sql
echo "CREATE DATABASE sbtest2;" >> /home/postgres/init.sql
echo "CREATE USER pmm WITH PASSWORD 'pmm';" >> /home/postgres/init.sql
echo "GRANT pg_monitor TO pmm;" >> /home/postgres/init.sql
echo "ALTER USER postgres PASSWORD 'pass+this';" >> /home/postgres/init.sql
service postgresql start

su postgres bash -c 'psql -f /home/postgres/init.sql'
su postgres bash -c 'psql -c "CREATE DATABASE contrib_regression;"'
su postgres bash -c 'psql -U postgres -c "CREATE EXTENSION pg_stat_monitor;"'
