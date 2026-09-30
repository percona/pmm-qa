#!/usr/bin/env bash
#
# images/pxc/setup.sh -- PXC with ProxySQL, on the prebaked pxc-proxysql image.

# Percona XtraDB Cluster: three nodes and ProxySQL in the one container
# pxc_proxysql_pmm_VERSION, on the prebaked pmm-qa/pxc-proxysql image
# (images/pxc/pmm-pxc):
# node N on 127.0.0.1:3305+N, ProxySQL admin on 6032 and host port 6033, and
# one pmm-agent monitoring all of them. Tests exec into the container by name.
#
# ProxySQL is 2 below PXC 8.4 and 3 from it, baked into the image, so the
# old PROXYSQL_VERSION and PROXYSQL_PACKAGE overrides are refused rather
# than silently ignored. TARBALL builds a pre-release into its own image tag.
setup_pxc() {
  local version client query_source pxc_tarball image_tag container tarball='' suffix
  version=$(resolved_version PXC_VERSION PXC "$DB_VERSION")
  client=$(resolved_client_version PXC DB_CONFIG)
  query_source=$(resolve_value PXC QUERY_SOURCE DB_CONFIG)
  pxc_tarball=$(resolve_value PXC TARBALL DB_CONFIG)
  image_tag=$(pxc_proxysql_tag "$version" "$pxc_tarball")
  container=pxc_proxysql_pmm_$version
  suffix=$((RANDOM % 9999 + 1))

  if [[ -n ${PROXYSQL_VERSION:-}${PROXYSQL_PACKAGE:-} ]]; then
    die 'PROXYSQL_VERSION and PROXYSQL_PACKAGE are not supported on the prebaked PXC image.'
  fi

  step "Prepare image pmm-qa/pxc-proxysql:$image_tag" \
    ensure_image pxc-proxysql "$image_tag" "$version" "$pxc_tarball"
  tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  step 'Clean previous run' fresh_containers "$container"
  step 'Start PXC nodes and ProxySQL' pxc_start
  if [[ $query_source == slowlog ]]; then
    step 'Enable the slow query log' pxc_enable_slowlog
  fi
  attach_pmm_client "$container" "$client" "$tarball" /pmm-agent.log \
    "${container//./_}${SHARD_NAME:+-$SHARD_NAME}"
  step 'Register PXC and ProxySQL with PMM' pxc_register
  step 'Run workload' pxc_workload
  report_agent_status "$container"
}

pxc_start() {
  must docker run --detach --init --name "$container" --hostname "$container" \
    --label pmm-qa.engine=pxc --network pmm-qa --publish 6033:6033 \
    "pmm-qa/pxc-proxysql:$image_tag" >/dev/null
  docker exec --user root "$container" pmm-pxc start ||
    die "PXC did not come up in $container."
}

pxc_enable_slowlog() {
  local node
  for node in 1 2 3; do
    docker exec "$container" mysql -uroot -S "/var/lib/pxc/node$node/mysql.sock" -e \
      "SET GLOBAL slow_query_log=ON; SET GLOBAL long_query_time=0; SET GLOBAL log_slow_rate_limit=1;
       SET GLOBAL log_slow_verbosity='full'; SET GLOBAL log_slow_rate_type='query';" ||
      die "Enabling the slow log on PXC node $node failed."
  done
}

# The node is registered without the version's dot: dashboards compare
# node_name with `=` against a multi-value variable, whose value Grafana
# regex-escapes, so pxc_proxysql_pmm_8.4 would never match itself. The nightly
# shard is appended so two shards on one PMM Server do
# not replace each other's node.
pxc_exporters_running() {
  local status
  status=$(docker exec "$container" pmm-admin status 2>&1) || return 1
  (($(grep -Eic 'mysqld_exporter.*(running|waiting)' <<<"$status") == 3)) &&
    grep -Eiq 'proxysql_exporter.*(running|waiting)' <<<"$status"
}

pxc_register() {
  local node
  for node in 1 2 3; do
    pmm_register "$container" pmm-admin add mysql "--query-source=$query_source" \
      --username=admin --password=admin --host=127.0.0.1 "--port=$((3305 + node))" \
      --environment=pxc-dev --cluster=pxc-dev-cluster --replication-set=pxc-repl \
      "pxc_node__${node}_$suffix"
  done
  pmm_register "$container" pmm-admin add proxysql --username=admin --password=admin \
    "--service-name=my-new-proxysql_${container}_$suffix" --host=127.0.0.1 --port=6032
  retry 60 "the PXC and ProxySQL exporters in $container" pxc_exporters_running >/dev/null
  wait_exporters "$container" /pmm-agent.log
}

# As in client_container_proxysql_setup.sh, the load keeps running after setup:
# a 12000 s read-only run and an unbounded read-write run through ProxySQL.
pxc_workload() {
  local sysbench='sysbench --mysql-db=sbtest --mysql-user=proxysql_user --mysql-password=passw0rd
    --mysql-host=127.0.0.1 --mysql-port=6033 --db-driver=mysql --threads=1 --tables=10 --table-size=1000'
  sysbench=${sysbench//$'\n'/ }
  must docker exec "$container" sh -c 'echo running > /tmp/workload.rc'
  must docker exec --detach "$container" sh -c "
    $sysbench /usr/share/sysbench/oltp_insert.lua prepare > /tmp/workload.log 2>&1
    echo \$? > /tmp/workload.rc
    $sysbench /usr/share/sysbench/oltp_read_only.lua --time=12000 run > /tmp/workload-read-only.log 2>&1 &
    $sysbench /usr/share/sysbench/oltp_read_write.lua --time=0 run > /tmp/workload-read-write.log 2>&1 &
    wait"
  # shellcheck disable=SC2016 # expanded by the container's shell
  retry 60 'the sysbench prepare' docker exec "$container" sh -c '[ "$(cat /tmp/workload.rc)" != running ]' >/dev/null
  # shellcheck disable=SC2016 # expanded by the container's shell
  must docker exec "$container" sh -c '[ "$(cat /tmp/workload.rc)" = 0 ] || { tail -20 /tmp/workload.log; exit 1; }'
}
