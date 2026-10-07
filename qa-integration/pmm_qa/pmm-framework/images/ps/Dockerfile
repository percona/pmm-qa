# Percona Server with sysbench, built from source, and xtrabackup. Built by
# build_ps_image in lib/images.sh; PMM Client is installed at run time.
ARG PS_IMAGE

FROM ${PS_IMAGE} AS sysbench-builder
ARG SYSBENCH_VERSION

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

FROM ${PS_IMAGE}
ARG XTRABACKUP_PACKAGE

COPY --from=sysbench-builder /sysbench-root/usr/local/bin/sysbench /usr/local/bin/sysbench
COPY --from=sysbench-builder /sysbench-root/usr/local/share/sysbench /usr/local/share/sysbench

USER root
# iproute: the Nomad agent pmm-agent runs needs `ip`.
RUN set -eux; \
    : "${XTRABACKUP_PACKAGE:?XTRABACKUP_PACKAGE build-arg is required}"; \
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

# The AMI upgrade runner calls `apt install -y pmm-client`; apt is this image's installer.
RUN ln -s "$(command -v dnf || command -v microdnf)" /usr/local/bin/apt

USER mysql
