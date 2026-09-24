# Built with qa-integration/pmm_psmdb-pbm_setup as the context: the same
# systemd layout as that stack's Dockerfile, minus the PMM Client, which
# setup_psmdb installs at run time.
ARG OL_VERSION=9
FROM oraclelinux:${OL_VERSION}

ARG OL_VERSION
# A major (8.0) installs its newest patch; a full patch (8.0.26-11) pins it.
ARG PSMDB_VERSION=8.0
ARG PBM_VERSION=2.9.1-1
ARG MGODATAGEN_VERSION=0.11.2

RUN (cd /lib/systemd/system/sysinit.target.wants/; for i in *; do [ $i == systemd-tmpfiles-setup.service ] || rm -f $i; done); \
    rm -f /lib/systemd/system/multi-user.target.wants/* \
          /etc/systemd/system/*.wants/* \
          /lib/systemd/system/local-fs.target.wants/* \
          /lib/systemd/system/sockets.target.wants/*udev* \
          /lib/systemd/system/sockets.target.wants/*initctl* \
          /lib/systemd/system/basic.target.wants/* \
          /lib/systemd/system/anaconda.target.wants/*

RUN set -eux; \
    major=$(echo "$PSMDB_VERSION" | cut -d. -f1-2); \
    case $PSMDB_VERSION in *-*) pin="-${PSMDB_VERSION}.el${OL_VERSION}" ;; *) pin='' ;; esac; \
    dnf install -y curl findutils gzip openssl tar krb5-workstation; \
    rpm -Uvh https://repo.percona.com/yum/percona-release-latest.noarch.rpm; \
    percona-release enable "psmdb-${major/./}" release; \
    percona-release enable pbm release; \
    dnf install -y "percona-server-mongodb${pin}" "percona-server-mongodb-tools${pin}" \
        "percona-server-mongodb-server${pin}" "percona-server-mongodb-mongos${pin}" \
        "percona-backup-mongodb-${PBM_VERSION}.el${OL_VERSION}"; \
    curl -fL --retry 5 -o /tmp/mgodatagen.tar.gz \
        "https://github.com/feliixx/mgodatagen/releases/download/v${MGODATAGEN_VERSION}/mgodatagen_${MGODATAGEN_VERSION}_Linux_x86_64.tar.gz"; \
    tar -xf /tmp/mgodatagen.tar.gz -C /usr/bin mgodatagen; \
    sed -i 's/Type=forking/#Type=forking/' /usr/lib/systemd/system/mongod.service; \
    systemctl enable mongod pbm-agent; \
    dnf clean all; \
    rm -rf /var/cache/dnf /tmp/mgodatagen.tar.gz /data/db; \
    mkdir -p /data/db; \
    ln -s /usr/bin/mongosh /usr/bin/mongo; \
    mongod --version | grep -q "v${PSMDB_VERSION%%-*}"

COPY conf/sysconfig/mongod /etc/sysconfig/
COPY --chown=mongod --chmod=0400 keyfile /etc/keyfile
COPY conf/krb/krb5.conf /etc/krb5.conf
COPY conf/mongos/mongos.service /usr/lib/systemd/system/mongos.service

VOLUME ["/sys/fs/cgroup"]
EXPOSE 27017
CMD ["/usr/sbin/init"]
