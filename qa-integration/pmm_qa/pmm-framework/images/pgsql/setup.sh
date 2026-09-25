#!/usr/bin/env bash
#
# images/pgsql/setup.sh -- PGSQL, on the prebaked pgsql image or the official postgres image.

# Upstream PostgreSQL, monitored through pg_stat_statements. The default is
# the old Ansible setup's single node on pmm-qa/pgsql; SETUP_TYPE=replication
# is its primary and replica on the official postgres image, which needs nothing baked in.
setup_pgsql() {
  local version setup_type client encrypted minor tarball='' suffix=$((RANDOM % 10000))
  version=$(resolved_version PGSQL_VERSION PGSQL "$DB_VERSION")
  setup_type=$(resolve_value PGSQL SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  client=$(resolved_client_version PGSQL DB_CONFIG)
  encrypted=$(bool_string "$(resolve_value PGSQL ENCRYPTED_CLIENT_CONFIG DB_CONFIG)")
  if [[ $encrypted == true && $client == 3.*.* ]]; then
    minor=${client#3.}
    minor=${minor%%.*}
    ((minor >= 7)) || encrypted=false
  fi
  case $setup_type in
    '') ;;
    replication) ;;
    *) die "PGSQL SETUP_TYPE must be empty or replication (got '$setup_type')." ;;
  esac
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  if [[ -z $setup_type ]]; then
    pgsql_pgss
  else
    pgsql_replication
  fi
}

# Only the replication playbook read ENCRYPTED_CLIENT_CONFIG.
pgsql_pgss() {
  local container=pgsql_pgss_pmm_$version
  step "Prepare image pmm-qa/pgsql:$version" ensure_image pgsql "$version"
  step 'Start PostgreSQL' pgsql_pgss_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' install_pmm_client "$container" "$client" "$tarball"
  step 'Set up PMM agent' setup_pmm_agent "$container" false /pmm-agent.log "$container${SHARD_NAME:+-$SHARD_NAME}"
  step 'Wait for pmm-agent' wait_pmm_agent "$container"
  pg_add "$container" pmm-admin add postgresql --username=pmm --password=pmm --query-source=pgstatements \
    "${container}_service_$suffix"
  wait_exporter "$container" postgres_exporter
  wait_node_exporter "$container" /pmm-agent.log
  must docker exec --detach "$container" bash /pgsm_run_queries.sh
  report_agent_status "$container"
}

pgsql_pgss_start() {
  docker rm -fv "$container" >/dev/null 2>&1 || true
  ensure_pmm_network
  must docker run --detach --name "$container" --label pmm-qa.engine=pgsql --network pmm-qa \
    --publish 5448:5432 "pmm-qa/pgsql:$version" >/dev/null
  must docker exec "$container" service postgresql start >/dev/null
  pdpgsql_ready "$container"
}

pgsql_replication() {
  local image=postgres:$version-bookworm node
  local -a names=("pgsql_pmm_${version}_1" "pgsql_pmm_${version}_2")
  step 'Start the primary and its replica' pgsql_replication_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' each_node names install_pmm_client "$client" "$tarball"
  step 'Set up PMM agents' pdpgsql_setup_agents
  step 'Register PostgreSQL with PMM' each_node names pgsql_register
  # pgbench runs detached: the playbook waited out its 120 s.
  must docker exec --detach --user postgres "${names[0]}" sh -c \
    'pgbench -i -s 1000 pgbench && pgbench -c 10 -T 120 -j 4 pgbench >/tmp/pgbench.log 2>&1'
  for node in "${names[@]}"; do
    report_agent_status "$node"
  done
}

pgsql_replication_start() {
  local conf=$FRAMEWORK_DIR/images/pgsql hba=${XDG_CACHE_HOME:-$HOME/.cache}/pmm-framework/pgsql_pg_hba.conf
  local primary=${names[0]} replica=${names[1]}
  docker rm -fv "${names[@]}" >/dev/null 2>&1 || true
  ensure_pmm_network
  must mkdir -p "${hba%/*}"
  printf '%s\n' 'host    replication     repl_user      0.0.0.0/0       md5' \
    'host    all             all             0.0.0.0/0       md5' \
    'local   all             postgres                        trust' >"$hba" || die "Could not write $hba."
  must docker run --detach --name "$primary" --restart=always --label pmm-qa.engine=pgsql --network pmm-qa \
    --env POSTGRES_PASSWORD=GRgrO9301RuF --volume "$conf/postgresql-primary.conf:/etc/postgresql/postgresql.conf:ro" \
    --volume "$hba:/etc/postgresql/pg_hba.conf:ro" --publish 6432:5432 \
    "$image" -c config_file=/etc/postgresql/postgresql.conf >/dev/null
  # Over TCP: the entrypoint's first-boot server listens on the socket only.
  retry 120 "PostgreSQL on $primary" docker exec --user postgres "$primary" pg_isready -q -h 127.0.0.1 >/dev/null
  pdpgsql_sql "$primary" "CREATE ROLE repl_user WITH REPLICATION LOGIN ENCRYPTED PASSWORD 'GRgrO9301RuF';"
  pdpgsql_sql "$primary" "CREATE USER pmm WITH PASSWORD 'pmm'; GRANT pg_monitor TO pmm;"
  pdpgsql_sql "$primary" 'CREATE DATABASE pgbench;'
  pdpgsql_sql "$primary" 'GRANT CONNECT ON DATABASE pgbench TO pmm;
    GRANT USAGE ON SCHEMA public TO pmm;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pmm;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pmm;' pgbench
  # The replica clones the primary into its own PGDATA before its first start,
  # so it needs no host data directory.
  # shellcheck disable=SC2016 # expanded by the container's shell
  must docker run --detach --name "$replica" --label pmm-qa.engine=pgsql --network pmm-qa \
    --env POSTGRES_PASSWORD=GRgrO9301RuF --volume "$conf/postgres-replica.conf:/etc/postgresql/postgresql.conf:ro" \
    --volume "$hba:/etc/postgresql/pg_hba.conf:ro" --publish 6433:5432 --entrypoint bash "$image" -ceu \
    'mkdir -p "$PGDATA" && chown postgres "$PGDATA"
     gosu postgres env PGPASSWORD=GRgrO9301RuF pg_basebackup "--pgdata=$PGDATA" -R -Fp -Xs --checkpoint=fast \
       "--host=$0" --port=5432 -U repl_user
     exec docker-entrypoint.sh postgres -c config_file=/etc/postgresql/postgresql.conf' "$primary" >/dev/null
  retry 120 "PostgreSQL on $replica" docker exec --user postgres "$replica" pg_isready -q -h 127.0.0.1 >/dev/null
  retry 60 "$primary to stream to $replica" pdpgsql_streaming "$primary" 1
  pdpgsql_sql "$primary" 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;'
}

# The playbook suffixed a service name only when the server already had it.
pgsql_register() {
  local out
  local -a add=(pmm-admin add postgresql --username=pmm --password=pmm --query-source=pgstatements)
  if ! out=$(docker exec "$1" "${add[@]}" "$1" --debug 127.0.0.1:5432 2>&1); then
    [[ $out == *'already exists'* ]] || die "Registering $1 failed: $out"
    pg_add "$1" "${add[@]}" "${1}_$suffix" --debug 127.0.0.1:5432
  fi
  wait_exporter "$1" postgres_exporter
  wait_node_exporter "$1" /var/log/pmm-agent.log
}
