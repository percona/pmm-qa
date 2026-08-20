ARG OL_VERSION=9
FROM oraclelinux:${OL_VERSION}

ARG PSMDB_VERSION
# Full patch release to pin, e.g. 8.0.26-11 (the form percona's downloads API reports). dnf will
# not match that without a dist suffix, so .el$OL_VERSION is appended when it carries none.
ARG PSMDB_PATCH=
# Re-declared after FROM: the pre-FROM ARG is out of scope in the build stage.
ARG OL_VERSION
ARG MGODATAGEN_VERSION=0.11.2

RUN dnf install -y curl findutils gzip openssl tar \
    && curl -fL https://repo.percona.com/yum/percona-release-latest.noarch.rpm \
        -o /tmp/percona-release.rpm \
    && rpm -Uvh /tmp/percona-release.rpm \
    && rm /tmp/percona-release.rpm \
    && percona-release enable "psmdb-${PSMDB_VERSION/./}" release \
    && percona-release enable pbm release \
    && PIN="" \
    && if [ -n "$PSMDB_PATCH" ]; then \
         case "$PSMDB_PATCH" in *.el[0-9]*) PIN="-$PSMDB_PATCH" ;; \
                                *) PIN="-${PSMDB_PATCH}.el${OL_VERSION}" ;; esac; \
       fi \
    && dnf install -y krb5-workstation \
        percona-backup-mongodb \
        "percona-server-mongodb${PIN}" \
        "percona-server-mongodb-mongos${PIN}" \
        "percona-server-mongodb-server${PIN}" \
        "percona-server-mongodb-tools${PIN}" \
    && ln -s /usr/bin/dnf /usr/bin/microdnf \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    # A pin that fails to apply would otherwise build clean against the repo's newest release.
    && if [ -n "$PSMDB_PATCH" ]; then mongod --version | grep -q "${PSMDB_PATCH%%.el*}"; fi

RUN curl -fL \
        "https://github.com/feliixx/mgodatagen/releases/download/v${MGODATAGEN_VERSION}/mgodatagen_${MGODATAGEN_VERSION}_Linux_x86_64.tar.gz" \
        -o /tmp/mgodatagen.tar.gz \
    && tar -xzf /tmp/mgodatagen.tar.gz -C /usr/local/bin mgodatagen \
    && rm /tmp/mgodatagen.tar.gz \
    && printf '%s\n' 'cG1tLXFhLXBzbWRiLXJlcGxpY2Etc2V0LWtleQ==' > /etc/mongodb-keyfile \
    && chown mongod:mongod /etc/mongodb-keyfile \
    && chmod 400 /etc/mongodb-keyfile \
    && mkdir -p /data/db /home/mongod /usr/share/pmm-qa/datagen \
    && openssl req -new -x509 -days 3650 -nodes -subj '/CN=localhost' -keyout /etc/mongodb.key -out /etc/mongodb-ca.crt \
    && cat /etc/mongodb.key /etc/mongodb-ca.crt > /etc/mongodb.pem \
    && chmod 600 /etc/mongodb.pem \
    && chown mongod:mongod /etc/mongodb.pem /etc/mongodb-ca.crt \
    && chown -R mongod:mongod /data/db /home/mongod

COPY --chown=mongod:mongod data/ /usr/share/pmm-qa/datagen/
COPY krb5.conf /etc/krb5.conf

USER mongod
EXPOSE 27017
