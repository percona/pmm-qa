#!/usr/bin/env bash

SERVICE_NAME=$1
METRIC_NAME=$2
PMM_SERVER_IP=$3
AGENT_TYPE=$4
AGENT_USER=$5
AGENT_PASSWORD=$6

export SERVICE_ID=$(pmm-admin list | grep -m1 ${SERVICE_NAME} | awk -F" " '{print $4}')
export AGENT_ID=$(pmm-admin list | grep ${SERVICE_ID} | grep ${AGENT_TYPE} | awk -F" " '{print $4}')
export LISTEN_PORT=$(curl -s "http://${PMM_SERVER_IP}/v1/inventory/Agents/List" -H 'Authorization: Basic YWRtaW46YWRtaW4=' --data-raw '{"promise":{}}' --compressed --insecure | jq ".${AGENT_TYPE}[] | select(.agent_id == "\"${AGENT_ID}"\") | .listen_port")
curl -s "http://${AGENT_USER}:${AGENT_PASSWORD}@127.0.0.1:${LISTEN_PORT}/metrics" | grep "${METRIC_NAME} 1"
