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

# Overlay a pre-release PXC binary tarball onto the packaged install, replacing pmm-framework's
# PXC_TARBALL. Empty keeps the image's own build. The base image keeps owning the entrypoint,
# node.cnf and SST scripts; only binaries and the galera provider are swapped.
#
# The version assertion at the end is the point of this block: a tarball whose layout does not
# match the paths below would otherwise leave the packaged binaries in place and silently test the
# wrong build, which for a pre-release QA image is worse than failing.
ARG PXC_TARBALL=
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
    mysqld --version; \
    [ "$(mysqld --version)" != "$packaged" ]

USER mysql
