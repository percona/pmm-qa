# check=skip=InvalidDefaultArgInFrom
# Community PostgreSQL from PGDG with pg_stat_statements on systemd, set up by pgss_setup.sh. Its
# unit starts at boot, under the alias `postgresql` that tests restart it
# through. Built by build_pgsql_image in lib/images.sh.
ARG BASE_OS

FROM ${BASE_OS}
ARG PG_VERSION
ENV PATH=/usr/pgsql-${PG_VERSION}/bin:$PATH

COPY pgss_setup.sh run_queries.sh /

RUN set -eux; \
    : "${PG_VERSION:?PG_VERSION build-arg is required}"; \
    bash /pgss_setup.sh "$PG_VERSION"

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
