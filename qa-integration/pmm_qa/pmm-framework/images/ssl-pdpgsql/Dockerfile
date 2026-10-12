# Percona Distribution for PostgreSQL with TLS, set up by install_pgsql.sh on a
# phusion base. The certificates that script makes are dropped, so none is
# published: setup_ssl_pdpgsql makes each container its own with
# create_certs.sh before starting PostgreSQL. Built by build_ssl_pdpgsql_image
# in lib/images.sh.
FROM phusion/baseimage:jammy-1.0.1
ARG PG_VERSION
ENV DEBIAN_FRONTEND=noninteractive

COPY create_certs.sh /artifacts/
COPY install_pgsql.sh init.sql /

RUN set -eux; \
    : "${PG_VERSION:?PG_VERSION build-arg is required}"; \
    bash -e /install_pgsql.sh "$PG_VERSION"; \
    service postgresql stop; \
    rm -rf /artifacts/certificates; \
    cd "/var/lib/postgresql/$PG_VERSION/main"; \
    rm -f ca.* server.* client.*
