#!/usr/bin/env bash
#
# images/external/setup.sh -- the External exporters, on the prebaked external image.

# External exporters (redis_exporter and process-exporter) registered with PMM,
# on the prebaked pmm-qa/external image: redis_container on host port 6379 and
# external_pmm serving redis_exporter on :42200, which remote-instance tests
# reach from the server, and process-exporter on :9256.
#
# Their versions are not spec options -- override them with the REDIS_VERSION
# and NODE_PROCESS_VERSION environment variables, which build their own tag.
setup_external() {
  local container=external_pmm client tarball='' tag suffix=$((RANDOM % 10000))
  client=$(resolved_client_version EXTERNAL DB_CONFIG)
  tag=${REDIS_VERSION:-1.58.0}-${NODE_PROCESS_VERSION:-0.7.10}
  step "Prepare image pmm-qa/external:$tag" ensure_image external "$tag"
  tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  step 'Start Redis and the exporters' external_start
  attach_pmm_client "$container" "$client" "$tarball" /var/log/pmm-agent.log
  pmm_register "$container" pmm-admin add external --listen-port=42200 --group=redis \
    "--service-name=redis_external_service_$suffix"
  pmm_register "$container" pmm-admin add external --listen-port=9256 --group=processes \
    "--service-name=nodeprocess_service_$suffix"
  wait_exporters "$container" /var/log/pmm-agent.log
  report_agent_status "$container"
}

external_start() {
  fresh_containers "$container" redis_container
  must docker run --detach --name redis_container --label pmm-qa.engine=external --network pmm-qa \
    --publish 6379:6379 redis --requirepass oFukiBRg7GujAJXq3tmd >/dev/null
  must docker run --detach --name "$container" --hostname "$container" --label pmm-qa.engine=external \
    --network pmm-qa "${NOMAD_CGROUPS[@]}" "pmm-qa/external:$tag" >/dev/null
  must docker exec --detach "$container" sh -c 'exec redis_exporter --redis.addr=redis://redis_container:6379 \
    --redis.password=oFukiBRg7GujAJXq3tmd --web.listen-address=:42200 >/redis.log 2>&1'
  must docker exec --detach "$container" sh -c 'exec process-exporter --web.listen-address=:9256 >/process-exporter.log 2>&1'
  retry 60 'redis_exporter on :42200' docker exec "$container" curl -fsS http://127.0.0.1:42200/metrics >/dev/null
  retry 60 'process-exporter on :9256' docker exec "$container" curl -fsS http://127.0.0.1:9256/metrics >/dev/null
}
