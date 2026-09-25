# Percona Distribution for PostgreSQL with TLS, set up by the playbook's own
# tls-ssl-setup/postgres/setup_pgsql.sh on the phusion base it used. The
# certificates that script makes are dropped, so none is published:
# setup_ssl_pdpgsql makes each container its own before starting PostgreSQL.
# The build context is qa-integration/pmm_qa/tls-ssl-setup.
FROM phusion/baseimage:jammy-1.0.1

ARG PG_VERSION=17
ENV DEBIAN_FRONTEND=noninteractive

COPY create_certs.sh /artifacts/
COPY postgres/setup_pgsql.sh postgres/init.sql /

RUN set -eux; \
    bash -e /setup_pgsql.sh --pgsql_version "$PG_VERSION"; \
    service postgresql stop; \
    rm -rf /artifacts/certificates; \
    cd "/var/lib/postgresql/$PG_VERSION/main"; \
    rm -f ca.* server.* client.*
