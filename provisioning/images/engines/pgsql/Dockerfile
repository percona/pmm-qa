FROM rockylinux:9

ARG PGSQL_VERSION=18

RUN dnf install -y findutils gzip openssl tar \
    "https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm" \
    && dnf -qy module disable postgresql \
    && dnf install -y "postgresql${PGSQL_VERSION}" "postgresql${PGSQL_VERSION}-contrib" "postgresql${PGSQL_VERSION}-server" \
    && ln -s /usr/bin/dnf /usr/bin/microdnf \
    && for command in initdb pg_basebackup pg_ctl postgres psql; do \
         ln -s "/usr/pgsql-${PGSQL_VERSION}/bin/$command" "/usr/local/bin/$command"; \
       done \
    && dnf clean all \
    && mkdir -p /var/lib/pgsql/data \
    && chown -R postgres:postgres /var/lib/pgsql

COPY entrypoint.sh /usr/local/bin/pgsql-entrypoint
RUN chmod +x /usr/local/bin/pgsql-entrypoint

USER postgres
ENV PGDATA=/var/lib/pgsql/data
EXPOSE 5432
ENTRYPOINT ["pgsql-entrypoint"]
