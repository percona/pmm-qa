ARG MYSQL_IMAGE=mysql:8.4
ARG SYSBENCH_VERSION=1.0.20

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
RUN curl -fL \
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
RUN yum install -y \
        curl \
        findutils \
        gzip \
        openssl \
        tar \
    && yum clean all \
    && sysbench --version \
    && tar --version

USER mysql

# mysql:8.0+ ships on Oracle Linux 9; EPEL sysbench does not conflict there.
FROM ${MYSQL_IMAGE} AS mysql-epel

USER root
RUN set -eux; \
    if command -v microdnf >/dev/null; then \
        PKG_MGR=microdnf; \
    else \
        PKG_MGR=yum; \
    fi; \
    . /etc/os-release; \
    curl -fL \
        "https://dl.fedoraproject.org/pub/epel/epel-release-latest-${VERSION_ID%%.*}.noarch.rpm" \
        -o /tmp/epel-release.rpm; \
    rpm -Uvh /tmp/epel-release.rpm; \
    rm /tmp/epel-release.rpm; \
    "$PKG_MGR" install -y sysbench curl findutils gzip openssl tar; \
    "$PKG_MGR" clean all; \
    sysbench --version; \
    tar --version

USER mysql
