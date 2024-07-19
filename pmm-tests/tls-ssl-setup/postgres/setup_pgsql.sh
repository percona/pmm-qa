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
      export pgsql_version=13
fi

apt-get update
apt-get -y install wget curl git gnupg2 lsb-release
wget https://repo.percona.com/apt/percona-release_latest.generic_all.deb
dpkg -i percona-release_latest.generic_all.deb
percona-release setup ppg${pgsql_version}
sleep 10
pushd artifacts
bash -x create_certs.sh
popd
sleep 10
pwd
apt -y install percona-postgresql-${pgsql_version}
apt -y install percona-postgresql-contrib
sleep 10
sed -i 's/\(host\s*all\s*all\s*127.0.0.1.*\) md5/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
sed -i 's/\(host\s*all\s*all\s*::1.*\) md5/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
sed -i 's/\(local\s*all\s*postgres.*\) peer/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
sed -i 's/\(local\s*all\s*all.*\) peer/\1 trust/g' /etc/postgresql/${pgsql_version}/main/pg_hba.conf
service postgresql restart
sleep 10
cp -a ./artifacts/certificates/. /var/lib/postgresql/${pgsql_version}/main/
ls -la ./artifacts/certificates/
chown -R postgres:postgres /var/lib/postgresql/${pgsql_version}/main
chmod 0700 -R /var/lib/postgresql/${pgsql_version}/main
sed -i "s/ssl_cert_file.*/ssl_cert_file = 'server.crt'/g" /etc/postgresql/${pgsql_version}/main/postgresql.conf
sed -i "s/#listen_addresses.*/listen_addresses = '*'/g" /etc/postgresql/${pgsql_version}/main/postgresql.conf
sed -i "s/ssl_key_file.*/ssl_key_file = 'server.key'/g" /etc/postgresql/${pgsql_version}/main/postgresql.conf
sed -i "s/ssl_ca_file.*/ssl_ca_file = 'ca.crt'/g" /etc/postgresql/${pgsql_version}/main/postgresql.conf
sed -i "s/#ssl_prefer_server_ciphers.*/ssl_prefer_server_ciphers = on/g" /etc/postgresql/${pgsql_version}/main/postgresql.conf
echo "hostssl    all     all             0.0.0.0/0                 md5" >> /etc/postgresql/${pgsql_version}/main/pg_hba.conf
echo "host    all             all              0.0.0.0/0                       md5" >> /etc/postgresql/${pgsql_version}/main/pg_hba.conf
sleep 10
service postgresql restart
su postgres bash -c 'psql -f init.sql'
service postgresql restart
