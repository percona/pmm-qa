#!/bin/bash

Nodes=$1
DB=$2
ACTION=$3
for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
    echo "$i"
    let COUNTER=COUNTER+1
    MYSQL_IP_PORT=${i}
done
for k in `seq 1 ${Nodes}`;do
        if [[ "${DB}" == "ms" && "${ACTION}" != "delete" ]]; then
            if [ $(( ${k} % 2 )) -eq 0 ]; then	
                echo "Adding Slow Log";
                pmm-admin add mysql --query-source=slowlog --username=msandbox --password=msandbox --environment=slow-log-test ms_sl_lt_${k} ${MYSQL_IP_PORT}
            else
                echo "Adding Performance Schema";
                pmm-admin add mysql --query-source=perfschema --username=msandbox --password=msandbox --environment=performance-schema-test ms_ps_lt_${k} ${MYSQL_IP_PORT}
            fi
        fi
        if [[ "${DB}" == "ms" && "${ACTION}" == "delete" ]]; then
            pmm-admin remove mysql ps_LT_${k} --debug
        fi
        sleep 15
done
