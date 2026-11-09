#!/usr/bin/env bash
#
# images/empty/setup.sh -- nodes with PMM Client and no database, on the prebaked empty image.

# empty-pmm-1..NODES_COUNT for Operations for MongoDB to scan and install
# MongoDB onto. Replica set members address each other by PMM node name, so
# each node's is its container name, which pmm-qa resolves. pmm-agent runs
# Nomad, hence --privileged.
setup_empty() {
  local client tarball='' count i node
  local -a names=()
  client=$(resolved_client_version EMPTY DB_CONFIG)
  count=$(resolve_value EMPTY NODES_COUNT DB_CONFIG)
  [[ $count =~ ^[1-9][0-9]*$ ]] || die "EMPTY NODES_COUNT must be a positive integer (got '$count')."
  for ((i = 1; i <= count; i++)); do
    names+=("empty-pmm-$i")
  done
  step 'Prepare image pmm-qa/empty:latest' ensure_image empty latest
  tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  step 'Start the nodes' empty_start
  for node in "${names[@]}"; do
    attach_pmm_client "$node" "$client" "$tarball" /var/log/pmm-agent.log "$node"
    wait_exporters "$node" /var/log/pmm-agent.log
  done
  report_agent_status "${names[@]}"
}

empty_start() {
  local node
  fresh_containers "${names[@]}"
  for node in "${names[@]}"; do
    must docker run --detach --name "$node" --hostname "$node" --label pmm-qa.engine=empty \
      --network pmm-qa "${SYSTEMD_RUN[@]}" --privileged pmm-qa/empty:latest >/dev/null
  done
}
