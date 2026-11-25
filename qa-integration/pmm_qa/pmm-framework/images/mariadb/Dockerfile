# check=skip=InvalidDefaultArgInFrom
# MariaDB from MariaDB's EL9 repository, with EPEL's sysbench, on systemd.
# setup_mysql_family writes mysqld's options to /etc/my.cnf.d and starts the
# mariadb unit. Built by build_mariadb_image in lib/images.sh; PMM Client is
# installed at run time.
ARG BASE_OS

FROM ${BASE_OS}
# A series, such as 12.3
ARG MARIADB_VERSION

# iproute: the Nomad agent pmm-agent runs needs `ip`. perl: pt-mysql-summary,
# behind the Service Summary panel.
RUN set -eux; \
    : "${MARIADB_VERSION:?MARIADB_VERSION build-arg is required}"; \
    printf '%s\n' '[mariadb]' 'name=MariaDB Server' \
      "baseurl=https://rpm.mariadb.org/$MARIADB_VERSION/rhel/9/\$basearch" \
      'gpgcheck=1' 'gpgkey=https://rpm.mariadb.org/RPM-GPG-KEY-MariaDB' >/etc/yum.repos.d/mariadb.repo; \
    dnf install -y "https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm"; \
    # EPEL's master, not its mirror list: lagging mirrors fail the metadata checksum.
    sed -i 's|^metalink=.*|baseurl=https://dl.fedoraproject.org/pub/epel/9/Everything/$basearch/|' /etc/yum.repos.d/epel.repo; \
    dnf install -y MariaDB-server MariaDB-client MariaDB-backup systemd sudo sysbench iproute openssl perl procps-ng \
        findutils gzip tar; \
    dnf clean all; \
    rm -rf /var/cache/dnf /var/lib/mysql/*; \
    systemctl disable mariadb; \
    mkdir -p /etc/my.cnf.d; \
    grep -q '^!includedir /etc/my.cnf.d' /etc/my.cnf || echo '!includedir /etc/my.cnf.d' >>/etc/my.cnf; \
    mariadbd --version | grep -q " $MARIADB_VERSION"; \
    mysql --version; \
    mysqladmin --version; \
    sysbench --version

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
