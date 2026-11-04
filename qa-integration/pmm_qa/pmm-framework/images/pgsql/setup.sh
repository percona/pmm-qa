#!/usr/bin/env bash
#
# images/pgsql/setup.sh -- PGSQL, on the prebaked pgsql image.

setup_pgsql() {
  local version setup_type client encrypted tarball='' suffix=$((RANDOM % 10000))
  version=$(resolved_version PGSQL_VERSION PGSQL "$DB_VERSION")
  setup_type=$(resolve_value PGSQL SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  client=$(resolved_client_version PGSQL DB_CONFIG)
  # shellcheck disable=SC2034  # lib/pmm_client.sh reads encrypted
  encrypted=$(resolved_encrypted PGSQL "$client")
  case $setup_type in
    '' | replication) ;;
    *) die "PGSQL SETUP_TYPE must be empty or replication (got '$setup_type')." ;;
  esac
  step "Prepare image pmm-qa/pgsql:$version" ensure_image pgsql "$version"
  tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  if [[ -z $setup_type ]]; then
    pgsql_pgss
  else
    pgsql_replication
  fi
}

# ENCRYPTED_CLIENT_CONFIG applies to replication only.
pgsql_pgss() {
  local container=pgsql_pgss_pmm_$version
  step 'Start PostgreSQL' pgsql_pgss_start
  attach_pmm_client "$container" "$client" "$tarball" /pmm-agent.log
  pmm_register "$container" pmm-admin add postgresql --username=pmm --password=pmm --query-source=pgstatements \
    "${container}_service_$suffix"
  wait_exporters "$container" /pmm-agent.log postgres_exporter
  must docker exec --detach "$container" bash /run_queries.sh
  report_agent_status "$container"
}

pgsql_pgss_start() {
  fresh_containers "$container"
  must docker run --detach --name "$container" --label pmm-qa.engine=pgsql --network pmm-qa \
    "${SYSTEMD_RUN[@]}" --publish 5448:5432 "pmm-qa/pgsql:$version" >/dev/null
  pdpgsql_ready "$container"
}

pgsql_replication() {
  local -a names=("pgsql_pmm_${version}_1" "pgsql_pmm_${version}_2")
  step 'Start the primary and its replica' pgsql_replication_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' each_node names install_pmm_client "$client" "$tarball"
  step 'Set up PMM agents' pdpgsql_setup_agents
  step 'Register PostgreSQL with PMM' each_node names pgsql_register
  # pgbench runs detached rather than blocking the setup for its 120 s.
  must docker exec --detach --user postgres "${names[0]}" sh -c \
    'pgbench -i -s 1000 pgbench && pgbench -c 10 -T 120 -j 4 pgbench >/tmp/pgbench.log 2>&1'
  report_agent_status "${names[@]}"
}

pgsql_replication_start() {
  local primary=${names[0]} replica=${names[1]} data=/var/lib/pgsql/$version/data node
  fresh_containers "${names[@]}"
  for node in "${names[@]}"; do
    must docker run --detach --name "$node" --restart=always --label pmm-qa.engine=pgsql --network pmm-qa \
      "${SYSTEMD_RUN[@]}" --publish "$((6431 + ${node##*_})):5432" "pmm-qa/pgsql:$version" >/dev/null
    pdpgsql_ready "$node"
  done
  pdpgsql_sql "$primary" "CREATE ROLE repl_user WITH REPLICATION LOGIN ENCRYPTED PASSWORD 'GRgrO9301RuF';
    ALTER USER postgres PASSWORD 'GRgrO9301RuF';"
  pdpgsql_sql "$primary" 'CREATE DATABASE pgbench;'
  pdpgsql_grant_pmm "$primary" pgbench
  must docker exec "$replica" systemctl stop postgresql
  must docker exec --user postgres "$replica" rm -rf "$data"
  must docker exec --user postgres --env PGPASSWORD=GRgrO9301RuF "$replica" timeout 120 \
    pg_basebackup "--pgdata=$data" -R -Fp -Xs --checkpoint=fast "--host=$primary" --port=5432 -U repl_user
  must docker exec "$replica" systemctl start postgresql
  pdpgsql_ready "$replica"
  retry 60 "$primary to stream to $replica" pdpgsql_streaming "$primary" 1
}

# The service name gets a suffix only when the server already has it.
pgsql_register() {
  local out
  local -a add=(pmm-admin add postgresql --username=pmm --password=pmm --query-source=pgstatements)
  if ! out=$(docker exec "$1" "${add[@]}" "$1" --debug 127.0.0.1:5432 2>&1); then
    [[ $out == *'already exists'* ]] || die "Registering $1 failed: $out"
    pmm_register "$1" "${add[@]}" "${1}_$suffix" --debug 127.0.0.1:5432
  fi
  wait_exporters "$1" /var/log/pmm-agent.log postgres_exporter
}
