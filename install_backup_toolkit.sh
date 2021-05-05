#!/bin/bash
msql_version=$1
if [[ \$msql_version == '5.7' ]]; then
    sudo yum install percona-xtrabackup-24  qpress -y
elif [[ \$msql_version == '8.0' ]]; then
    sudo yum install percona-xtrabackup-80  qpress -y
else
    echo "ERROR! You have selected version of mysql not supported by backup tools"
    exit 1
exit 0