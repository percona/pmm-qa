ARG PXC_IMAGE=percona/percona-xtradb-cluster:8.0
FROM ${PXC_IMAGE}

USER root
RUN set -eux; \
    if command -v microdnf >/dev/null; then PKG_MGR=microdnf; else PKG_MGR=yum; fi; \
    "$PKG_MGR" install -y findutils gzip openssl tar; \
    . /etc/os-release; \
    curl -fL "https://dl.fedoraproject.org/pub/epel/epel-release-latest-${VERSION_ID%%.*}.noarch.rpm" -o /tmp/epel.rpm; \
    rpm -Uvh /tmp/epel.rpm; \
    rm /tmp/epel.rpm; \
    "$PKG_MGR" install -y sysbench; \
    "$PKG_MGR" clean all; \
    command -v microdnf >/dev/null || ln -s /usr/bin/yum /usr/local/bin/microdnf; \
    sysbench --version; \
    sed -i '/\[mysqld\]/a pxc-encrypt-cluster-traffic=OFF' /etc/mysql/node.cnf

USER mysql
