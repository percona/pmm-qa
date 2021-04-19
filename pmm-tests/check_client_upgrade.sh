#!/bin/sh

#check for packages after upgrade

pmm-admin status | grep -q Running
pmm-admin status | grep node_exporter | grep -qv Waiting
pmm-admin status | grep vmagent | grep -qv Waiting
pmm-admin status | grep mysqld_exporter | grep -qv Waiting
pmm-admin status | grep mysql_perfschema_agent | grep -qv Waiting
server_version=$(pmm-admin status | grep Version | awk -F' ' '{print $2}')
if [ "$server_version" != "$1" ]; then
    echo "PMM Server Version is not equal to expected $1";
    exit 1;
fi
admin_version=$(pmm-admin status | grep pmm-admin | awk -F' ' '{print $3}')
if [ "$admin_version" != "$1" ]; then
    echo "PMM Admin Version is not equal to expected $1";
    exit 1;
fi
agent_version=$(pmm-admin status | grep pmm-agent | awk -F' ' '{print $3}')
if [ "$agent_version" != "$1" ]; then
    echo "PMM Agent Version is not equal to expected $1";
    exit 1;
fi
if [ "$agent_version" != "$admin_version" ]; then
    echo "PMM-Agent Version Does not Match PMM-Admin Version";
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
