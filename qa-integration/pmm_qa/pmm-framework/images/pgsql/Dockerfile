# PostgreSQL from PGDG with pg_stat_statements, set up by pgss_setup.sh on a
# phusion base. setup_pgsql starts it with `service`, which tests also restart
# it through. Built by build_pgsql_image in lib/images.sh.
FROM phusion/baseimage:jammy-1.0.1
ARG PG_VERSION
ENV DEBIAN_FRONTEND=noninteractive

COPY pgss_setup.sh run_queries.sh /

RUN set -eux; \
    : "${PG_VERSION:?PG_VERSION build-arg is required}"; \
    bash /pgss_setup.sh "$PG_VERSION"; \
    service postgresql stop
