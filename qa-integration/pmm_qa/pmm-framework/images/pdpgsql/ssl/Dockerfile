# Percona Distribution for PostgreSQL with TLS, set up by setup_pgsql.sh on a
# phusion base. The certificates that script makes are dropped, so none is
# published: setup_ssl_pdpgsql makes each container its own with
# create_certs.sh before starting PostgreSQL.
FROM phusion/baseimage:jammy-1.0.1

ARG PG_VERSION=17
ENV DEBIAN_FRONTEND=noninteractive

COPY create_certs.sh /artifacts/
COPY setup_pgsql.sh init.sql /

RUN set -eux; \
    bash -e /setup_pgsql.sh --pgsql_version "$PG_VERSION"; \
    service postgresql stop; \
    rm -rf /artifacts/certificates; \
    cd "/var/lib/postgresql/$PG_VERSION/main"; \
    rm -f ca.* server.* client.*
