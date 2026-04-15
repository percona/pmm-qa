ARG OL_VERSION=9
FROM oraclelinux:${OL_VERSION}
ARG REPO=testing
ARG PMM_REPO=experimental
ARG PBM_VERSION=latest
ARG PSMDB_VERSION=latest
ARG PMM_CLIENT_VERSION=latest

RUN (cd /lib/systemd/system/sysinit.target.wants/; for i in *; do [ $i == systemd-tmpfiles-setup.service ] || rm -f $i; done); \
rm -f /lib/systemd/system/multi-user.target.wants/*;\
rm -f /etc/systemd/system/*.wants/*;\
rm -f /lib/systemd/system/local-fs.target.wants/*; \
rm -f /lib/systemd/system/sockets.target.wants/*udev*; \
rm -f /lib/systemd/system/sockets.target.wants/*initctl*; \
rm -f /lib/systemd/system/basic.target.wants/*;\
rm -f /lib/systemd/system/anaconda.target.wants/*;

VOLUME [ "/sys/fs/cgroup" ]

CMD ["/usr/sbin/init"]

ARG OL_VERSION
RUN set -ex; \
    export GNUPGHOME="$(mktemp -d)"; \
    export PERCONA_TELEMETRY_URL="https://check-dev.percona.com/v1/telemetry/GenericReport"; \
    dnf install -y gnupg2; \
    if [ $PSMDB_VERSION != "latest" ]; then export PSMDB_REPO="$(echo "${PSMDB_VERSION}" | awk -F '.' '{print "psmdb-"$1$2}')" ; else export PSMDB_REPO=psmdb-80 ; fi ; \
    gpg --batch --keyserver keyserver.ubuntu.com --recv-keys 4D1BB29D63D98E422B2113B19334A25F8507EFA5 99DB70FAE1D7CE227FB6488205B555B38483C65D 94E279EB8D8F25B21810ADF121EA45AB2F86D6A1; \
    gpg --batch --export --armor 4D1BB29D63D98E422B2113B19334A25F8507EFA5 > ${GNUPGHOME}/PERCONA-PACKAGING-KEY; \
    gpg --batch --export --armor 99DB70FAE1D7CE227FB6488205B555B38483C65D > ${GNUPGHOME}/RPM-GPG-KEY-centosofficial; \
    gpg --batch --export --armor 94E279EB8D8F25B21810ADF121EA45AB2F86D6A1 > ${GNUPGHOME}/RPM-GPG-KEY-EPEL-9; \
    rpmkeys --import ${GNUPGHOME}/PERCONA-PACKAGING-KEY ${GNUPGHOME}/RPM-GPG-KEY-centosofficial ${GNUPGHOME}/RPM-GPG-KEY-EPEL-9; \
    curl -Lf -o /tmp/percona-release.rpm https://repo.percona.com/yum/percona-release-latest.noarch.rpm; \
    rpmkeys --checksig /tmp/percona-release.rpm; \
    rpm -i /tmp/percona-release.rpm; \
    rm -rf "$GNUPGHOME" /tmp/percona-release.rpm; \
    rpm --import /etc/pki/rpm-gpg/PERCONA-PACKAGING-KEY; \
    percona-release enable pbm ${REPO} && \
    percona-release enable ${PSMDB_REPO} ${REPO} && \
    percona-release enable pmm3-client ${PMM_REPO} && \
    dnf -y install https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm && \
    dnf update --refresh -y && \
    if [[ $PSMDB_VERSION == "latest" || "$PSMDB_VERSION" =~ ^[0-9]\.[0-9]$ ]] ; then \
        dnf -y install percona-server-mongodb \
                       percona-server-mongodb-tools \
                       percona-server-mongodb-server \
                       percona-server-mongodb-mongos ; \
    else \
        dnf -y install percona-server-mongodb-${PSMDB_VERSION}.el${OL_VERSION} \
                          percona-server-mongodb-tools-${PSMDB_VERSION}.el${OL_VERSION} \
                          percona-server-mongodb-server-${PSMDB_VERSION}.el${OL_VERSION} \
                          percona-server-mongodb-mongos-${PSMDB_VERSION}.el${OL_VERSION} ; \
    fi && \
    if [ "$PBM_VERSION" == "latest" ]; then \
        dnf -y install percona-backup-mongodb ; \
    else \
        dnf -y install percona-backup-mongodb-${PBM_VERSION}.el${OL_VERSION} ; \
    fi

ARG OL_VERSION
RUN if [[ "$PMM_CLIENT_VERSION" == http* ]]; then \
        dnf -y install pmm-client && \
        curl -Lf -o /tmp/pmm-client.tar.gz $PMM_CLIENT_VERSION && \
        cd /tmp && tar -xvf pmm-client.tar.gz --transform 's,^/*[^/]*,/pmm-client,S' && \
        cd /tmp/pmm-client && ./install_tarball && cd ../ && rm -rf pmm* ;\
    elif [[ "$PMM_CLIENT_VERSION" =~ 3-dev-latest|latest ]]; then \
        dnf -y install pmm-client ; \
    elif [[ "$PMM_CLIENT_VERSION" = "pmm3-rc" ]]; then \
        percona-release enable-only pmm3-client testing  && \
        dnf update --refresh -y && \
        dnf -y install pmm-client ; \
    else \
        percona-release enable pmm3-client release && \
        if [[ "$PMM_CLIENT_VERSION" =~ ^([3-9])\.([1-9][0-9]*)\.([0-9]+)$ ]]; then \
            dnf -y install pmm-client-${PMM_CLIENT_VERSION}-7.el${OL_VERSION} ; \
        else \
            dnf -y install pmm-client-${PMM_CLIENT_VERSION}-6.el${OL_VERSION} ; \
        fi \
    fi && \
    sed 's/Type=forking/#Type=forking/' -i /usr/lib/systemd/system/mongod.service && \
    systemctl enable mongod && \
    systemctl enable pbm-agent && \
    sed -i '/ExecStart/a StandardError=file:/var/log/pmm-agent.log' /usr/lib/systemd/system/pmm-agent.service && \
    sed -i '/\[Service\]/a Environment="KRB5_CLIENT_KTNAME=/keytabs/mongodb.keytab"' /usr/lib/systemd/system/pmm-agent.service && \
    systemctl enable pmm-agent && \
    curl -Lf -o /tmp/mgodatagen.tar.gz https://github.com/feliixx/mgodatagen/releases/download/v0.11.2/mgodatagen_0.11.2_Linux_x86_64.tar.gz && \
    tar -xf /tmp/mgodatagen.tar.gz -C /usr/bin && \
    dnf clean all; \
    rm -rf /var/cache/dnf /var/cache/dnf /data/db && mkdir -p /data/db;

COPY conf/sysconfig/mongod /etc/sysconfig/
COPY keyfile /etc/keyfile
COPY conf/krb/krb5.conf /etc/krb5.conf
RUN ln -s /usr/bin/mongosh /usr/bin/mongo || true
RUN chown mongod /etc/keyfile && chmod 400 /etc/keyfile
EXPOSE 27017
