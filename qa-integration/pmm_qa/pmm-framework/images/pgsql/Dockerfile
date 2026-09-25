# PostgreSQL from PGDG with pg_stat_statements, set up by
# pg_stat_statements_setup.sh on a phusion base. setup_pgsql starts it with
# `service`, which tests also restart it through.
FROM phusion/baseimage:jammy-1.0.1

ARG PG_VERSION=17
ENV DEBIAN_FRONTEND=noninteractive

COPY pg_stat_statements_setup.sh pgsm_run_queries.sh /

RUN set -eux; \
    bash -e /pg_stat_statements_setup.sh --pgsql_version "$PG_VERSION"; \
    service postgresql stop
