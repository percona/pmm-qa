#!/usr/bin/env bash
#
# images/haproxy/setup.sh -- HAProxy, on the prebaked haproxy image.

# HAProxy with the PMM Client attached, for the HAProxy dashboards, on the
# prebaked pmm-qa/haproxy image The end state is the old Ansible
# setup's: haproxy_pmm serving haproxy.cfg on host port 42100,
# registered with --environment=haproxy, with a request every 10 s.
setup_haproxy() {
  local container=haproxy_pmm client tarball='' suffix=$((RANDOM % 10000))
  client=$(resolved_client_version HAPROXY DB_CONFIG)
  step 'Prepare image pmm-qa/haproxy:ol9' ensure_image haproxy ol9
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  step 'Start HAProxy' haproxy_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' install_pmm_client "$container" "$client" "$tarball"
  # The playbook named the node after the container plus the nightly shard,
  # so shards sharing one PMM Server do not replace each other's node.
  step 'Set up PMM agent' setup_pmm_agent "$container" false /pmm-agent.log "$container${SHARD_NAME:+-$SHARD_NAME}"
  step 'Wait for pmm-agent' wait_pmm_agent "$container"
  retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering ${container}_service_$suffix" \
    docker exec "$container" pmm-admin add haproxy --listen-port=42100 --environment=haproxy \
    "${container}_service_$suffix" >/dev/null
  wait_node_exporter "$container" /pmm-agent.log
  must docker exec --detach "$container" sh -c 'while true; do curl -s http://127.0.0.1:42100/ >/dev/null; sleep 10; done'
  report_agent_status "$container"
}

haproxy_start() {
  docker rm -fv "$container" >/dev/null 2>&1 || true
  ensure_pmm_network
  must docker run --detach --name "$container" --hostname "$container" --label pmm-qa.engine=haproxy \
    --network pmm-qa --publish 42100:42100 "${NOMAD_CGROUPS[@]}" pmm-qa/haproxy:ol9 >/dev/null
  must docker cp "$FRAMEWORK_DIR/images/haproxy/haproxy.cfg" "$container:/haproxy.cfg"
  must docker exec "$container" haproxy -f /haproxy.cfg -D
  retry 30 "HAProxy's metrics on :42100" docker exec "$container" curl -fsS http://127.0.0.1:42100/metrics >/dev/null
}
