#!/bin/sh


versionMinor=$(echo $2 | cut -d "." -f 2)
echo "Minor Version is: $versionMinor"

if [ "$versionMinor" -ge "35" ]; then
    echo "Version Minor is greater or equal to 36.";
    #check for packages after upgrade
    pmm-admin status
    pmm-admin status | grep -q Running

    pmm-admin status | grep node_exporter | grep -qv Waiting
    pmm-admin status | grep node_exporter | grep -qv Unknown

    pmm-admin status | grep vmagent | grep -qv Waiting
    pmm-admin status | grep vmagent | grep -qv Unknown

    pmm-admin status | grep mysqld_exporter | grep -qv Waiting
    pmm-admin status | grep mysqld_exporter | grep -qv Unknown

    pmm-admin status | grep mysql_perfschema_agent | grep -qv Waiting
    pmm-admin status | grep mysql_perfschema_agent | grep -qv Unknown

    pmm-admin status | grep mongodb_exporter | grep -qv Waiting
    pmm-admin status | grep mongodb_exporter | grep -qv Unknown

    pmm-admin status | grep postgres_exporter | grep -qv Waiting
    pmm-admin status | grep postgres_exporter | grep -qv Unknown

    pmm-admin status | grep mongodb_profiler_agent | grep -qv Waiting
    pmm-admin status | grep mongodb_profiler_agent | grep -qv Unknown

    pmm-admin status | grep postgresql_pgstatements_agent | grep -qv Waiting
    pmm-admin status | grep postgresql_pgstatements_agent | grep -qv Unknown

    pmm-admin list 
    pmm-admin list | grep -q Running

    pmm-admin list | grep node_exporter | grep -qv Waiting
    pmm-admin list | grep node_exporter | grep -qv Unknown

    pmm-admin list | grep vmagent | grep -qv Waiting
    pmm-admin list | grep vmagent | grep -qv Unknown

    pmm-admin list | grep mysqld_exporter | grep -qv Waiting
    pmm-admin list | grep mysqld_exporter | grep -qv Unknown

    pmm-admin list | grep mysql_perfschema_agent | grep -qv Waiting
    pmm-admin list | grep mysql_perfschema_agent | grep -qv Unknown

    pmm-admin list | grep mongodb_exporter | grep -qv Waiting
    pmm-admin list | grep mongodb_exporter | grep -qv Unknown

    pmm-admin list | grep postgres_exporter | grep -qv Waiting
    pmm-admin list | grep postgres_exporter | grep -qv Unknown

    pmm-admin list | grep mongodb_profiler_agent | grep -qv Waiting
    pmm-admin list | grep mongodb_profiler_agent | grep -qv Unknown

    pmm-admin list | grep postgresql_pgstatements_agent | grep -qv Waiting
    pmm-admin list | grep postgresql_pgstatements_agent | grep -qv Unknown
fi

server_version=$(pmm-admin status | grep Version | awk -F' ' '{print $2}')
if [ "$server_version" != "$1" ]; then
    echo "PMM Server Version is not equal to expected $1";
    exit 1;
fi

if [ -z "$2" ]; then
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
else
    admin_version=$(pmm-admin status | grep pmm-admin | awk -F' ' '{print $3}')
    if [ "$admin_version" != "$2" ]; then
        echo "PMM Admin Version is not equal to expected $2";
        exit 1;
    fi
    agent_version=$(pmm-admin status | grep pmm-agent | awk -F' ' '{print $3}')
    if [ "$agent_version" != "$2" ]; then
        echo "PMM Agent Version is not equal to expected $2";
        exit 1;
    fi
    if [ "$agent_version" != "$admin_version" ]; then
        echo "PMM-Agent Version Does not Match PMM-Admin Version";
        exit 1;
    fi
fi

if [ "$versionMinor" -ge "23" ]; then
    echo "Exporter for azure was added in 2.23.0";
    ls -la /usr/local/percona/pmm2/exporters | grep -q azure_exporter
fi
ls -la /usr/local/percona/pmm2/exporters | grep -q mongodb_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q mysqld_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q node_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q postgres_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q proxysql_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q rds_exporter
ls -la /usr/local/percona/pmm2/exporters | grep -q vmagent
