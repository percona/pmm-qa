#!/bin/bash
msql_version=$1
sudo percona-release enable-only tools release;
sudo yum install https://repo.percona.com/yum/percona-release-latest.noarch.rpm
if [[ $msql_version == '5.7' ]]; then
    sudo yum install percona-xtrabackup-24  qpress -y
elif [[ $msql_version == '8.0' ]]; then
    sudo yum install percona-xtrabackup80  qpress -y
else
    echo "ERROR! You have selected non supported combination of version MySQL & XtraBackup"
    exit 1
exit 0
fi