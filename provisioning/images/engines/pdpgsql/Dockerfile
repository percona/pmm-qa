ARG PDPGSQL_VERSION=18
ARG PGSM_BRANCH=
FROM percona/percona-distribution-postgresql:${PDPGSQL_VERSION}-ubi8

USER root
RUN set -eux; \
    microdnf install -y curl findutils gzip openssl tar; \
    microdnf install -y etcd percona-patroni; \
    microdnf clean all; \
    patroni --version; \
    etcd --version

ARG PDPGSQL_VERSION
ARG PGSM_BRANCH
RUN set -eux; \
    if [ -n "$PGSM_BRANCH" ]; then \
      microdnf install -y gcc git make openssl-devel; \
      microdnf download -y percona-postgresql${PDPGSQL_VERSION}-devel; \
      rpm -i --nodeps /percona-postgresql${PDPGSQL_VERSION}-devel-*.rpm; \
      rm -f /percona-postgresql${PDPGSQL_VERSION}-devel-*.rpm; \
      git clone --depth 1 --branch "$PGSM_BRANCH" https://github.com/percona/pg_stat_monitor.git /tmp/pg_stat_monitor; \
      make -C /tmp/pg_stat_monitor USE_PGXS=1 PG_CONFIG=/usr/pgsql-${PDPGSQL_VERSION}/bin/pg_config with_llvm=no; \
      make -C /tmp/pg_stat_monitor USE_PGXS=1 PG_CONFIG=/usr/pgsql-${PDPGSQL_VERSION}/bin/pg_config with_llvm=no install; \
      rm -rf /tmp/pg_stat_monitor; \
      rpm -e --nodeps percona-postgresql${PDPGSQL_VERSION}-devel gcc git make openssl-devel; \
      microdnf clean all; \
    fi

USER postgres
