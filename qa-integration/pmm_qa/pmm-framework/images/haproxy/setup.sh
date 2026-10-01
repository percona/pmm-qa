#!/usr/bin/env bash
#
# images/haproxy/setup.sh -- HAProxy, on the prebaked haproxy image.

# HAProxy with the PMM Client attached, for the HAProxy dashboards, on the
# prebaked pmm-qa/haproxy image: haproxy_pmm serving haproxy.cfg on host port 42100,
# registered with --environment=haproxy, with a request every 10 s.
setup_haproxy() {
  local container=haproxy_pmm client tarball='' suffix=$((RANDOM % 10000))
  client=$(resolved_client_version HAPROXY DB_CONFIG)
  step 'Prepare image pmm-qa/haproxy:latest' ensure_image haproxy latest
  tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  step 'Start HAProxy' haproxy_start
  attach_pmm_client "$container" "$client" "$tarball" /pmm-agent.log
  pmm_register "$container" pmm-admin add haproxy --listen-port=42100 --environment=haproxy \
    "${container}_service_$suffix"
  wait_exporters "$container" /pmm-agent.log
  must docker exec --detach "$container" sh -c 'while true; do curl -s http://127.0.0.1:42100/ >/dev/null; sleep 10; done'
  report_agent_status "$container"
}

haproxy_start() {
  fresh_containers "$container"
  must docker run --detach --name "$container" --hostname "$container" --label pmm-qa.engine=haproxy \
    --network pmm-qa --publish 42100:42100 "${NOMAD_CGROUPS[@]}" pmm-qa/haproxy:latest >/dev/null
  must docker cp "$FRAMEWORK_DIR/images/haproxy/haproxy.cfg" "$container:/haproxy.cfg"
  must docker exec "$container" haproxy -f /haproxy.cfg -D
  retry 30 "HAProxy's metrics on :42100" docker exec "$container" curl -fsS http://127.0.0.1:42100/metrics >/dev/null
}
