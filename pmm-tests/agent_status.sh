#!/bin/sh

arr=("node_exporter"
     "mysqld_exporter"
     "mongodb_exporter"
     "mysql_perfschema_agent"
     "mongodb_profiler_agent"
     "postgres_exporter"
     "proxysql_exporter"
     "vmagent"
     "mysql_slowlog_agent"
     "postgresql_pgstatements_agent"
     "postgresql_pgstatmonitor_agent")

for agent in "${arr[@]}" ; do
        for i in $(pmm-admin status | grep ${agent}) ; do
                echo $i | grep -qv Waiting
        done
done
