# check=skip=InvalidDefaultArgInFrom
# Percona Distribution for PostgreSQL with TLS on systemd. No certificate is
# published: setup_ssl_pdpgsql makes each container its own with
# create_certs.sh, then starts the `postgresql` unit, which is left disabled
# because it cannot start without them. Built by build_ssl_pdpgsql_image in
# lib/images.sh.
ARG BASE_OS

FROM ${BASE_OS}
ARG PG_VERSION
ENV PATH=/usr/pgsql-${PG_VERSION}/bin:$PATH

COPY create_certs.sh /artifacts/
COPY init.sql /

RUN set -eux; \
    : "${PG_VERSION:?PG_VERSION build-arg is required}"; \
    data=/var/lib/pgsql/$PG_VERSION/data; \
    dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm; \
    percona-release enable-only "ppg-$PG_VERSION" release; \
    dnf install -y "percona-postgresql$PG_VERSION-server" "percona-postgresql$PG_VERSION-contrib" \
      systemd sudo initscripts-service openssl iproute procps-ng findutils gzip tar; \
    dnf clean all; \
    rm -rf /var/cache/dnf; \
    su postgres -c "initdb -D $data -E UTF8 --locale=C.UTF-8"; \
    printf '%s\n' \
      'local   all     all                       trust' \
      'host    all     all       127.0.0.1/32    trust' \
      'hostssl all     all       0.0.0.0/0       md5' \
      'host    all     all       0.0.0.0/0       md5' >"$data/pg_hba.conf"; \
    printf '%s\n' "listen_addresses = '*'" 'ssl = on' "ssl_cert_file = 'server.crt'" \
      "ssl_key_file = 'server.key'" "ssl_ca_file = 'ca.crt'" 'ssl_prefer_server_ciphers = on' >>"$data/postgresql.conf"; \
    su postgres -c "pg_ctl -D $data -o '-c ssl=off' -w start"; \
    su postgres -c 'psql -v ON_ERROR_STOP=1 -f /init.sql'; \
    su postgres -c "pg_ctl -D $data -w stop"; \
    ln -s "/usr/lib/systemd/system/postgresql-$PG_VERSION.service" /etc/systemd/system/postgresql.service

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
