#!/bin/bash

ps_group_repl_path="/home/ec2-user/sandboxes/group_sp_msb_8_0_20"
ms_single_path="/home/ec2-user/sandboxes/msb_8_0_33"
addresses_and_ports=$(pmm-admin list | awk '/MySQL/ { print $3 }')
failed_services=""

for address_and_port in $addresses_and_ports; do
  address=$(echo "$address_and_port" | cut -d':' -f1)
  port=$(echo "$address_and_port" | cut -d':' -f2)
  
  if timeout 10 bash -c "</dev/tcp/$address/$port"; then
    echo "Connection successful: $address:$port"
  else
    echo "Connection failed: $address:$port"
    failed_services="$failed_services $(pmm-admin list | grep $address:$port | awk '{print $2}')"
  fi
done

echo "Failed services: $failed_services"

if [ -n "$failed_services" ]; then
  for service in $failed_services; do
    if [[ "$service" == ms-single* ]]; then
      "$ms_single_path/restart"
    elif [[ "$service" == ps_group* ]]; then
      node=$(echo $service | tr -d '_' | tail -c 6)
      "$ps_group_repl_path/$node/restart"
    fi
  done
fi
