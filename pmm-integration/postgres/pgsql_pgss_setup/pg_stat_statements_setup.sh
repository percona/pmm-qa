#!/bin/sh

while [ $# -gt 0 ]; do

   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi

  shift
done

# If postgres server version is not provided then it will default to version 14.
if [ -z "$pgsql_version" ]
then
      export pgsql_version=14
fi

# If distribution is not provided then it will default to percona distribution 'PPG'
# For PG community distribution please use 'PGDG'
if [ -z "$distribution" ]
then
      export distribution=PPG
fi

# Need to add a user postgres either here or in Dockerfile
cd /home
mkdir postgres
useradd postgres
chown -R postgres:postgres postgres
cd postgres

# Install the dependencies
apt-get update
apt-get -y install wget curl git gnupg2 lsb-release
apt-get -y install libreadline6-dev systemtap-sdt-dev zlib1g-dev libssl-dev libpam0g-dev python-dev bison make flex libipc-run-perl wget
sleep 10

# Install the PG server from selected distribution
if [[ $distribution == "PGDG" ]];
then
      wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
      sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
      apt update
      apt -y install postgresql-${pgsql_version} postgresql-server-dev-${pgsql_version}
else
      wget https://repo.percona.com/apt/percona-release_latest.generic_all.deb
      dpkg -i percona-release_latest.generic_all.deb
      percona-release setup ppg-${pgsql_version}
      apt-get -y update
      apt-get -y install percona-postgresql-${pgsql_version} percona-postgresql-contrib percona-postgresql-server-dev-all
fi

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

# Stop server and edit postgresql.conf to load pg_stat_sstatement library with required configurations
service postgresql stop
echo "shared_preload_libraries = 'pg_stat_statements'" >> /etc/postgresql/${pgsql_version}/main/postgresql.conf
echo "track_activity_query_size=2048"  >> /etc/postgresql/${pgsql_version}/main/postgresql.conf
echo "track_io_timing=ON"  >> /etc/postgresql/${pgsql_version}/main/postgresql.conf

# Create init.sql file required by PMM
echo "CREATE DATABASE sbtest1;" >> /home/postgres/init.sql
echo "CREATE DATABASE sbtest2;" >> /home/postgres/init.sql
echo "CREATE USER pmm WITH PASSWORD 'pmm';" >> /home/postgres/init.sql
echo "GRANT pg_monitor TO pmm;" >> /home/postgres/init.sql
echo "ALTER USER postgres PASSWORD 'pass+this';" >> /home/postgres/init.sql

# Start server, run init.sql and Create extension PGSM
service postgresql start
su postgres bash -c 'psql -f /home/postgres/init.sql'
su postgres bash -c 'psql -c "CREATE DATABASE contrib_regression;"'
su postgres bash -c 'psql -U postgres -c "CREATE EXTENSION pg_stat_statements;"'
