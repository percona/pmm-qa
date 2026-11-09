# check=skip=InvalidDefaultArgInFrom
# Oracle's MySQL with sysbench. Built by build_mysql_image in lib/images.sh,
# which picks the mysql-57 or mysql-el9 stage; PMM Client is installed at run time.
ARG BASE_OS
ARG SYSBENCH_VERSION

# mysql:5.7 is Oracle Linux 7 without MySQL client headers; build sysbench on OL7.
FROM oraclelinux:7 AS sysbench-el7
ARG SYSBENCH_VERSION
RUN yum install -y \
        epel-release \
        mariadb-devel \
        autoconf \
        automake \
        gcc \
        gzip \
        libtool \
        make \
        openssl-devel \
        tar \
        curl \
        which \
    && yum clean all
RUN : "${SYSBENCH_VERSION:?SYSBENCH_VERSION build-arg is required}" \
    && curl -fL \
        "https://github.com/akopytov/sysbench/archive/refs/tags/${SYSBENCH_VERSION}.tar.gz" \
        -o /tmp/sysbench.tar.gz \
    && tar -xzf /tmp/sysbench.tar.gz -C /tmp \
    && cd "/tmp/sysbench-${SYSBENCH_VERSION}" \
    && ./autogen.sh \
    && ./configure --without-pgsql \
    && make -j"$(nproc)" \
    && make install DESTDIR=/sysbench-root

FROM mysql:5.7 AS mysql-57
COPY --from=sysbench-el7 /sysbench-root/usr/local/bin/sysbench /usr/local/bin/sysbench
COPY --from=sysbench-el7 /sysbench-root/usr/local/share/sysbench /usr/local/share/sysbench
COPY --from=sysbench-el7 /usr/lib64/mysql/libmysqlclient.so.18 /usr/local/lib64/
COPY --from=sysbench-el7 /usr/lib64/mysql/libmysqlclient.so.18.0.0 /usr/local/lib64/

USER root
RUN ln -sfn /usr/local/share/sysbench /usr/share/sysbench
RUN echo /usr/local/lib64 > /etc/ld.so.conf.d/sysbench-mysql.conf \
    && ldconfig
# iproute: the Nomad agent pmm-agent runs needs `ip`. perl: pt-mysql-summary,
# behind the Service Summary panel, which the PMM Client tarball does not pull in.
RUN yum install -y \
        curl \
        findutils \
        gzip \
        iproute \
        openssl \
        perl \
        tar \
    && yum clean all \
    && sysbench --version \
    && tar --version

USER mysql

# 8.0+ from Oracle's EL9 repository, on systemd. setup_mysql_family writes
# mysqld's options to /etc/my.cnf.d and starts the mysqld unit.
FROM ${BASE_OS} AS mysql-el9
ARG MYSQL_VERSION

RUN set -eux; \
    : "${MYSQL_VERSION:?MYSQL_VERSION build-arg is required}"; \
    printf '%s\n' '[mysql-community]' 'name=MySQL Community Server' \
      "baseurl=https://repo.mysql.com/yum/mysql-$MYSQL_VERSION-community/el/9/\$basearch/" \
      'gpgcheck=1' 'gpgkey=https://repo.mysql.com/RPM-GPG-KEY-mysql-2023' >/etc/yum.repos.d/mysql-community.repo; \
    dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm \
        "https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm"; \
    # EPEL's master, not its mirror list: lagging mirrors fail the metadata checksum.
    sed -i 's|^metalink=.*|baseurl=https://dl.fedoraproject.org/pub/epel/9/Everything/$basearch/|' /etc/yum.repos.d/epel.repo; \
    dnf install -y mysql-community-server systemd sudo sysbench iproute openssl perl procps-ng findutils gzip tar; \
    dnf clean all; \
    rm -rf /var/cache/dnf /var/lib/mysql/*; \
    systemctl disable mysqld; \
    mkdir -p /etc/my.cnf.d; \
    grep -q '^!includedir /etc/my.cnf.d' /etc/my.cnf || echo '!includedir /etc/my.cnf.d' >>/etc/my.cnf; \
    mysqld --version | grep -q " $MYSQL_VERSION"; \
    sysbench --version

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
