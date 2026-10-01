ARG PS_IMAGE=percona/percona-server:8.4
FROM ${PS_IMAGE} AS sysbench-builder

USER root
RUN microdnf install -y \
        automake \
        gcc \
        gzip \
        libtool \
        make \
        openssl-devel \
        pkgconf-pkg-config \
    && microdnf clean all

ARG SYSBENCH_VERSION=1.0.20
RUN curl -fL \
        "https://github.com/akopytov/sysbench/archive/refs/tags/${SYSBENCH_VERSION}.tar.gz" \
        -o /tmp/sysbench.tar.gz \
    && tar -xzf /tmp/sysbench.tar.gz -C /tmp \
    && cd "/tmp/sysbench-${SYSBENCH_VERSION}" \
    && ./autogen.sh \
    && ./configure --without-pgsql \
    && make -j"$(nproc)" \
    && make install DESTDIR=/sysbench-root

FROM ${PS_IMAGE}

COPY --from=sysbench-builder /sysbench-root/usr/local/bin/sysbench /usr/local/bin/sysbench
COPY --from=sysbench-builder /sysbench-root/usr/local/share/sysbench /usr/local/share/sysbench

USER root
ARG XTRABACKUP_PACKAGE=percona-xtrabackup-84
# iproute: the Nomad agent pmm-agent runs needs `ip`.
RUN set -eux; \
    curl -fL https://repo.percona.com/yum/percona-release-latest.noarch.rpm -o /tmp/percona-release.rpm; \
    rpm -Uvh --replacepkgs /tmp/percona-release.rpm; \
    percona-release enable tools release; \
    case "${XTRABACKUP_PACKAGE}" in *-9*) percona-release enable "pxb-${XTRABACKUP_PACKAGE##*-}-lts" release ;; esac; \
    . /etc/os-release; \
    curl -fL "https://dl.fedoraproject.org/pub/epel/epel-release-latest-${VERSION_ID%%.*}.noarch.rpm" -o /tmp/epel-release.rpm; \
    rpm -Uvh /tmp/epel-release.rpm; \
    curl -fL "https://repo.almalinux.org/almalinux/8/AppStream/$(uname -m)/os/Packages/libev-4.24-6.el8.$(uname -m).rpm" -o /tmp/libev.rpm; \
    rpm -Uvh /tmp/libev.rpm; \
    microdnf install -y iproute qpress tar ${XTRABACKUP_PACKAGE}; \
    microdnf clean all; \
    rm -f /tmp/*.rpm; \
    ln -sfn /usr/local/share/sysbench /usr/share/sysbench; \
    xtrabackup --version; \
    sysbench --version

USER mysql
