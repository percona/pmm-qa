ARG PDPGSQL_VERSION=18
FROM percona/percona-distribution-postgresql:${PDPGSQL_VERSION}-ubi8

USER root
RUN set -eux; \
    microdnf install -y curl findutils gzip openssl tar; \
    microdnf install -y etcd percona-patroni; \
    microdnf clean all; \
    patroni --version; \
    etcd --version

USER postgres
