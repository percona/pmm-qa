# PostgreSQL from PGDG with pg_stat_statements, set up by the playbook's own
# pg_stat_statements_setup.sh on the phusion base it ran on. setup_pgsql starts
# it with `service`, which tests also restart it through. The build context is
# qa-integration/pmm_qa; Dockerfile.dockerignore keeps it to the two scripts.
FROM phusion/baseimage:jammy-1.0.1

ARG PG_VERSION=17
ENV DEBIAN_FRONTEND=noninteractive

COPY pg_stat_statements_setup.sh pgsm_run_queries.sh /

RUN set -eux; \
    bash -e /pg_stat_statements_setup.sh --pgsql_version "$PG_VERSION"; \
    service postgresql stop
