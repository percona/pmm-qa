# Percona Distribution for PostgreSQL on the systemd Ubuntu the old Ansible setup used,
# with every package its three topologies install. Tests run
# `service postgresql restart` and read /var/log/postgresql, so systemd and the
# Debian cluster layout stay. The single-node postgresql.conf and pg_hba.conf
# are baked in; setup_pdpgsql rewrites them for replication and patroni.
FROM antmelekhin/docker-systemd:ubuntu-24.04

ARG PG_VERSION=17
ENV DEBIAN_FRONTEND=noninteractive

RUN set -eux; \
    apt-get update; \
    apt-get install -y curl gnupg2 iproute2 jq lsb-release wget; \
    curl -fsSL --retry 5 -o /tmp/percona-release.deb https://repo.percona.com/apt/percona-release_latest.generic_all.deb; \
    apt-get install -y /tmp/percona-release.deb; \
    rm /tmp/percona-release.deb; \
    percona-release enable "ppg-$PG_VERSION"; \
    apt-get install -y "percona-postgresql-$PG_VERSION" percona-pgbackrest "percona-pg-stat-monitor$PG_VERSION" \
      percona-patroni etcd python3-etcd; \
    patroni --version

RUN set -eux; \
    conf=/etc/postgresql/$PG_VERSION/main; \
    printf '%s\n' \
      "listen_addresses = '*'" \
      "hba_file = '$conf/pg_hba.conf'" \
      "data_directory = '/var/lib/postgresql/$PG_VERSION/main'" \
      "shared_preload_libraries = 'pg_stat_monitor'" \
      'track_activity_query_size=2048' \
      'track_io_timing=ON' \
      'max_connections=1000' \
      "pg_stat_monitor.pgsm_enable_query_plan = 'yes'" \
      'log_connections = on' \
      'log_disconnections = on' \
      'log_replication_commands = on' \
      "log_statement = 'all'" >"$conf/postgresql.conf"; \
    printf '%s\n' \
      'host    replication     repl_user      0.0.0.0/0       md5' \
      'host    all             all            0.0.0.0/0       md5' \
      'local   all             postgres       trust' \
      'local   all             all            md5' >"$conf/pg_hba.conf"; \
    chown postgres:postgres "$conf/postgresql.conf" "$conf/pg_hba.conf"
