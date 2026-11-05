# check=skip=InvalidDefaultArgInFrom
# Percona Server from Percona's EL9 repositories, with MyRocks, xtrabackup and
# EPEL's sysbench, on systemd. setup_mysql_family writes mysqld's options to
# /etc/my.cnf.d and starts the mysqld unit. Built by build_ps_image in
# lib/images.sh; PMM Client is installed at run time.
ARG BASE_OS

FROM ${BASE_OS}
# 5.7, 8.0, 8.4 or 9.7
ARG PS_VERSION

# iproute: the Nomad agent pmm-agent runs needs `ip`. perl: pt-mysql-summary,
# behind the Service Summary panel.
RUN set -eux; \
    : "${PS_VERSION:?PS_VERSION build-arg is required}"; \
    v=${PS_VERSION/./}; \
    case $PS_VERSION in \
      5.7) repo=ps-57 pkgs="Percona-Server-server-57 Percona-Server-rocksdb-57 percona-xtrabackup-24" ;; \
      8.0) repo=ps-80 pkgs="percona-server-server percona-server-rocksdb percona-xtrabackup-80" ;; \
      *) repo=ps-$v-lts pkgs="percona-server-server percona-server-rocksdb percona-xtrabackup-$v" ;; \
    esac; \
    dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm \
        "https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm"; \
    # EPEL's master, not its mirror list: lagging mirrors fail the metadata checksum.
    sed -i 's|^metalink=.*|baseurl=https://dl.fedoraproject.org/pub/epel/9/Everything/$basearch/|' /etc/yum.repos.d/epel.repo; \
    percona-release enable-only "$repo" release; \
    percona-release enable tools release; \
    case $PS_VERSION in 8.4 | 9.*) percona-release enable "pxb-$v-lts" release ;; esac; \
    dnf install -y $pkgs systemd sudo sysbench qpress iproute openssl perl procps-ng findutils gzip tar; \
    dnf clean all; \
    rm -rf /var/cache/dnf /var/lib/mysql/*; \
    systemctl disable mysqld; \
    # No telemetry from test containers, as in Percona's own images.
    if rpm -q percona-telemetry-agent; then systemctl disable percona-telemetry-agent; fi; \
    mkdir -p /etc/my.cnf.d; \
    grep -q '^!includedir /etc/my.cnf.d' /etc/my.cnf || echo '!includedir /etc/my.cnf.d' >>/etc/my.cnf; \
    mysqld --version | grep -q " $PS_VERSION"; \
    xtrabackup --version; \
    sysbench --version

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
