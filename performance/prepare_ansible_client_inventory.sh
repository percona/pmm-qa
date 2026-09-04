#!/usr/bin/env bash
rm inventory_client_container2
echo "[linode_clients]" >> inventory_client_container2;
touch inventory_client_container2
for i in $(linode-cli linodes list --format 'id,ipv4,label' --text --delimiter ";" --no-headers | grep sp_perf_390_to_391 | awk -F ';' '{print $2}'); do
	echo "${i} ansible_ssh_user=root ansible_ssh_private_key_file=/Users/shruti/.ssh/id_rsa" >> inventory_client_container2
	sleep 3
done
