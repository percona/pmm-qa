#!/bin/sh

#check for exporters and agents after client_upgrade on upgrade job.

pmm-admin status | grep -q Running
pmm-admin status | grep node_exporter | grep -qv Waiting
pmm-admin status | grep vmagent | grep -qv Waiting
pmm-admin status | grep mysqld_exporter | grep -qv Waiting
pmm-admin status | grep mysql_perfschema_agent | grep -qv Waiting
pmm-admin status | grep Version | grep -q $1
version=$(pmm-admin status | grep Version | awk -F' ' '{print $2}')
if [ "$version" != "$1" ]; then
    echo "PMM Client Version is not equal to expected $1";
    exit 1;
fi
ls -la /usr/local/percona/pmm2/exporters | grep -q azure_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q mongodb_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q mysqld_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q node_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q postgres_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q proxysql_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q rds_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q vmagent
