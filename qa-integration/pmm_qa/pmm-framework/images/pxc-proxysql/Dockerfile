# Three PXC nodes and ProxySQL in one container, driven by pmm_pxc. Built by
# build_pxc_proxysql_image in lib/images.sh; PMM Client is installed at run time.
ARG PXC_VERSION

FROM percona/percona-xtradb-cluster:${PXC_VERSION}
ARG PXC_VERSION
# Empty installs Percona's proxysql2 2.7.3, as the Ansible setup pinned; a URL
# installs that ProxySQL rpm instead.
ARG PROXYSQL_PACKAGE
ARG PXC_TARBALL

USER root
RUN set -eux; \
    . /etc/os-release; \
    curl -fL "https://dl.fedoraproject.org/pub/epel/epel-release-latest-${VERSION_ID%%.*}.noarch.rpm" \
        -o /tmp/epel-release.rpm; \
    rpm -Uvh /tmp/epel-release.rpm; \
    rm /tmp/epel-release.rpm; \
    if [ -n "$PROXYSQL_PACKAGE" ]; then \
        curl -fL "$PROXYSQL_PACKAGE" -o /tmp/proxysql.rpm; \
        rpm -Uvh /tmp/proxysql.rpm; \
        rm /tmp/proxysql.rpm; \
    else \
        percona-release enable-only proxysql release; \
        microdnf install -y proxysql2-2.7.3; \
    fi; \
    microdnf install -y sysbench findutils gzip openssl tar; \
    microdnf clean all; \
    proxysql --version; \
    sysbench --version

# TARBALL= overlays a pre-release PXC binary tarball onto the packaged install.
# The version check fails a tarball whose layout left the packaged binaries in
# place, which would otherwise silently test the wrong build.
RUN set -eux; \
    if [ -z "$PXC_TARBALL" ]; then exit 0; fi; \
    packaged="$(mysqld --version)"; \
    mkdir -p /opt/pxc-tarball; \
    curl -fL "$PXC_TARBALL" -o /tmp/pxc.tar.gz; \
    tar -xzf /tmp/pxc.tar.gz -C /opt/pxc-tarball --strip-components=1; \
    rm /tmp/pxc.tar.gz; \
    for binary in /opt/pxc-tarball/bin/*; do \
      name="$(basename "$binary")"; \
      installed="$(command -v "$name" || true)"; \
      ln -sf "$binary" "${installed:-/usr/bin/$name}"; \
    done; \
    provider="$(find /opt/pxc-tarball/lib -name 'libgalera_smm.so' -print -quit)"; \
    [ -n "$provider" ]; \
    for existing in $(find /usr/lib64 /usr/lib -name 'libgalera_smm.so' 2>/dev/null); do \
      ln -sf "$provider" "$existing"; \
    done; \
    [ "$(mysqld --version)" != "$packaged" ]

COPY --chmod=0755 pmm_pxc /usr/local/bin/pmm_pxc
RUN pmm_pxc prepare "$PXC_VERSION"

ENTRYPOINT ["sleep", "infinity"]
