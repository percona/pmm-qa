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
## postgres user will need sudo permission to install the build PGSM library
## for that you can figure out where to give sudo permissions to postgres here
## or Dockerfile, totally up to you as you like
cd /home
mkdir postgres
useradd postgres
chown -R postgres:postgres postgres
cd postgres

## As usual install the dependencies
apt-get update
apt-get -y install wget curl git
apt-get install libreadline6-dev systemtap-sdt-dev zlib1g-dev libssl-dev libpam0g-dev python-dev bison flex libipc-run-perl -y docbook-xsl docbook-xsl
apt-get install -y libxml2 libxml2-utils libxml2-dev libxslt-dev xsltproc libkrb5-dev libldap2-dev libsystemd-dev gettext tcl-dev libperl-dev
apt-get install -y pkg-config clang-9 llvm-9 llvm-9-dev libselinux1-dev python-dev python3-dev uuid-dev liblz4-dev
apt-get install libreadline6-dev systemtap-sdt-dev zlib1g-dev libssl-dev libpam0g-dev python-dev bison make flex libipc-run-perl wget -y
sleep 10

## Don't use percona-distribution. Seems broken or missing a dependency.
## Use pgdg - postgres community distributions
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt-get update
apt-get -y install postgresql-${pgsql_version} postgresql-client-${pgsql_version} postgresql-contrib postgresql-server-dev-${pgsql_version}

## Nothing Changes
sleep 10
sed -i 's/\(host\s*all\s*all\s*127.0.0.1.*\) md5/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
sed -i 's/\(host\s*all\s*all\s*::1.*\) md5/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
sed -i 's/\(local\s*all\s*postgres.*\) peer/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
sed -i 's/\(local\s*all\s*all.*\) peer/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
service postgresql restart

## Nothing Changed
sleep 10
chown -R postgres:postgres /var/lib/postgresql/${pgsql_version}/main
chmod 0700 -R /var/lib/postgresql/${pgsql_version}/main
sed -i "s/#listen_addresses.*/listen_addresses = '*'/g" /etc/postgresql/${pgsql_version}/main/postgresql.conf
echo "host    all             all              0.0.0.0/0                       md5" >> /etc/postgresql/${pgsql_version}/main/pg_hba.conf

sleep 10
service postgresql restart
## I commented following line, uncomment if you are using some sql to load data
wget https://raw.githubusercontent.com/percona/pmm-qa/main/pmm-tests/tls-ssl-setup/postgres/init.sql
su postgres bash -c 'psql -f init.sql'
export PATH="/usr/lib/postgresql/${pgsql_version}/bin:$PATH"
echo $PATH
cp /usr/lib/postgresql/${pgsql_version}/bin/pg_config /usr/bin

## Down PGSM repo and move to /home/postgres/pg_stat_monitor dir
##
cd /home/postgres
git clone -b REL1_0_STABLE https://github.com/percona/pg_stat_monitor
chown -R postgres:postgres pg_stat_monitor
cd pg_stat_monitor

# Build PGSM 
make USE_PGXS=1

## Install build library into server
## NOTE: YOU NEED SUDO PERMISSION or root user to install into server
make USE_PGXS=1 install

#$ Stop and restart server to reload PGSM library
service postgresql stop
echo "shared_preload_libraries = 'pg_stat_monitor'" | tee -a /etc/postgresql/${pgsql_version}/main/postgresql.conf
service postgresql start
su postgres bash -c 'psql -c "CREATE DATABASE contrib_regression;"'
su postgres bash -c 'psql -d contrib_regression -c "CREATE EXTENSION pg_stat_monitor;"'

## Running Queries
wget https://raw.githubusercontent.com/percona/pmm-agent/pmm-2.26.0/testqueries/postgres/pg_stat_monitor_load.sql
