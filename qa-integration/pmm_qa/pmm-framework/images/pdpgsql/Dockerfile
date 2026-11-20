# check=skip=InvalidDefaultArgInFrom
# Percona Distribution for PostgreSQL on systemd, with every package its three
# topologies install. The single-node postgresql.conf and pg_hba.conf are
# baked in; setup_pdpgsql rewrites them for replication and patroni. Tests run
# `service postgresql restart` and read /var/log/postgresql/postgresql-VERSION-main.log,
# hence the unit alias and the log file name. Built by build_pdpgsql_image in
# lib/images.sh.
ARG BASE_OS

FROM ${BASE_OS}
ARG PG_VERSION
ENV PATH=/usr/pgsql-${PG_VERSION}/bin:$PATH

RUN set -eux; \
    : "${PG_VERSION:?PG_VERSION build-arg is required}"; \
    dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm \
        "https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm"; \
    # EPEL's master, not its mirror list: lagging mirrors fail the metadata checksum.
    sed -i 's|^metalink=.*|baseurl=https://dl.fedoraproject.org/pub/epel/9/Everything/$basearch/|' /etc/yum.repos.d/epel.repo; \
    percona-release enable-only "ppg-$PG_VERSION" release; \
    dnf install -y "percona-postgresql$PG_VERSION-server" "percona-postgresql$PG_VERSION-contrib" \
      "percona-pg_stat_monitor$PG_VERSION" percona-pgbackrest percona-patroni etcd python3-etcd \
    # iproute-tc: PMM-T2224 delays the loopback with tc (the setup adds NET_ADMIN).
      systemd sudo initscripts-service iproute iproute-tc jq procps-ng findutils gzip tar wget; \
    dnf clean all; \
    rm -rf /var/cache/dnf; \
    patroni --version

RUN set -eux; \
    data=/var/lib/pgsql/$PG_VERSION/data; \
    su postgres -c "initdb -D $data -E UTF8 --locale=C.UTF-8"; \
    printf '%s\n' \
      "listen_addresses = '*'" \
      "shared_preload_libraries = 'pg_stat_monitor'" \
      'track_activity_query_size=2048' \
      'track_io_timing=ON' \
      'max_connections=1000' \
      "pg_stat_monitor.pgsm_enable_query_plan = 'yes'" \
      'log_connections = on' \
      'log_disconnections = on' \
      'log_replication_commands = on' \
      "log_statement = 'all'" \
      "log_directory = '/var/log/postgresql'" \
      "log_filename = 'postgresql-$PG_VERSION-main.log'" >>"$data/postgresql.conf"; \
    printf '%s\n' \
      'host    replication     repl_user      0.0.0.0/0       md5' \
      'host    all             all            0.0.0.0/0       md5' \
      'local   all             postgres       trust' \
      'local   all             all            md5' >"$data/pg_hba.conf"; \
    install -d -o postgres -g postgres /var/log/postgresql; \
    ln -s "/usr/lib/systemd/system/postgresql-$PG_VERSION.service" /etc/systemd/system/postgresql.service; \
    systemctl enable "postgresql-$PG_VERSION"

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
