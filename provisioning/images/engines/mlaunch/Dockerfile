FROM oraclelinux:9

ARG MLAUNCH_ENGINE=psmdb
ARG MONGO_VERSION=8.0

RUN dnf install -y curl findutils gzip openssl tar python3 python3-pip \
    && if [ "$MLAUNCH_ENGINE" = "psmdb" ]; then \
         curl -fL https://repo.percona.com/yum/percona-release-latest.noarch.rpm -o /tmp/percona-release.rpm \
         && rpm -Uvh /tmp/percona-release.rpm \
         && rm /tmp/percona-release.rpm \
         && percona-release enable "psmdb-${MONGO_VERSION/./}" release \
         && dnf install -y percona-server-mongodb percona-server-mongodb-mongos percona-server-mongodb-server percona-server-mongodb-tools ; \
       else \
         printf '%s\n' '[mongodb-org]' 'name=MongoDB Repository' \
           "baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/${MONGO_VERSION}/x86_64/" \
           'gpgcheck=1' 'enabled=1' \
           "gpgkey=https://pgp.mongodb.com/server-${MONGO_VERSION}.asc" > /etc/yum.repos.d/mongodb-org.repo \
         && dnf install -y --allowerasing mongodb-org-server mongodb-org-mongos mongodb-mongosh mongodb-database-tools ; \
       fi \
    && ln -s /usr/bin/dnf /usr/bin/microdnf \
    && python3 -m pip install "mtools[mongodb]" psutil pymongo packaging \
    && printf '%s\n' 'cG1tLXFhLXBzbWRiLXJlcGxpY2Etc2V0LWtleQ==' > /etc/mongodb-keyfile \
    && chown mongod:mongod /etc/mongodb-keyfile \
    && chmod 400 /etc/mongodb-keyfile \
    && mkdir -p /data/db /home/mongod \
    && openssl req -new -x509 -days 3650 -nodes -subj '/CN=localhost' -keyout /etc/mongodb.key -out /etc/mongodb-ca.crt \
    && cat /etc/mongodb.key /etc/mongodb-ca.crt > /etc/mongodb.pem \
    && chmod 600 /etc/mongodb.pem \
    && chown mongod:mongod /etc/mongodb.pem /etc/mongodb-ca.crt \
    && chown -R mongod:mongod /data/db /home/mongod \
    && dnf clean all \
    && rm -rf /var/cache/dnf

USER mongod
EXPOSE 27017 27018 27019
