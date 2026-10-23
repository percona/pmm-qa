# check=skip=InvalidDefaultArgInFrom
# Three PXC nodes and ProxySQL in one container, driven by pmm_pxc, on systemd.
# Built by build_pxc_proxysql_image in lib/images.sh; PMM Client is installed
# at run time.
ARG BASE_OS

FROM ${BASE_OS}
ARG PXC_VERSION
# Empty installs Percona's proxysql2 2.7.3, as the Ansible setup pinned; a URL
# installs that ProxySQL rpm instead.
ARG PROXYSQL_PACKAGE
ARG PXC_TARBALL

RUN set -eux; \
    : "${PXC_VERSION:?PXC_VERSION build-arg is required}"; \
    v=${PXC_VERSION/./}; \
    case $PXC_VERSION in \
      5.7) repo=pxc-57 pkg=Percona-XtraDB-Cluster-57 ;; \
      8.0) repo=pxc-80 pkg=percona-xtradb-cluster ;; \
      *) repo=pxc-$v-lts pkg=percona-xtradb-cluster ;; \
    esac; \
    dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm \
        "https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm"; \
    # EPEL's master, not its mirror list: lagging mirrors fail the metadata checksum.
    sed -i 's|^metalink=.*|baseurl=https://dl.fedoraproject.org/pub/epel/9/Everything/$basearch/|' /etc/yum.repos.d/epel.repo; \
    percona-release enable-only "$repo" release; \
    percona-release enable tools release; \
    if [ -n "$PROXYSQL_PACKAGE" ]; then \
        dnf install -y "$PROXYSQL_PACKAGE"; \
    else \
        percona-release enable proxysql release; \
        dnf install -y proxysql2-2.7.3; \
    fi; \
    dnf install -y "$pkg" systemd sudo sysbench iproute findutils gzip openssl procps-ng tar; \
    dnf clean all; \
    rm -rf /var/cache/dnf; \
    # pmm_pxc runs the nodes and ProxySQL, so their packaged units must not start at boot.
    systemctl disable mysql; \
    if systemctl is-enabled -q proxysql; then systemctl disable proxysql; fi; \
    # No telemetry from test containers, as in Percona's own images.
    if rpm -q percona-telemetry-agent; then systemctl disable percona-telemetry-agent; fi; \
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

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
