FROM rockylinux:9

ARG MONGODB_VERSION=8.0
ARG MGODATAGEN_VERSION=0.11.2

RUN printf '%s\n' '[mongodb-org]' 'name=MongoDB Repository' \
      "baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/${MONGODB_VERSION}/x86_64/" \
      'gpgcheck=1' 'enabled=1' \
      "gpgkey=https://pgp.mongodb.com/server-${MONGODB_VERSION}.asc" > /etc/yum.repos.d/mongodb-org.repo \
    && dnf install -y --allowerasing curl findutils gzip openssl tar mongodb-org-server mongodb-org-mongos mongodb-mongosh mongodb-database-tools \
    && ln -s /usr/bin/dnf /usr/bin/microdnf \
    && curl -fL "https://github.com/feliixx/mgodatagen/releases/download/v${MGODATAGEN_VERSION}/mgodatagen_${MGODATAGEN_VERSION}_Linux_x86_64.tar.gz" -o /tmp/mgodatagen.tar.gz \
    && tar -xzf /tmp/mgodatagen.tar.gz -C /usr/local/bin mgodatagen \
    && rm /tmp/mgodatagen.tar.gz \
    && printf '%s\n' 'cG1tLXFhLXBzbWRiLXJlcGEtc2V0LWtleQ==' > /etc/mongodb-keyfile \
    && openssl req -new -x509 -days 3650 -nodes -subj '/CN=localhost' -keyout /etc/mongodb.key -out /etc/mongodb-ca.crt \
    && cat /etc/mongodb.key /etc/mongodb-ca.crt > /etc/mongodb.pem \
    && chmod 400 /etc/mongodb-keyfile && chmod 600 /etc/mongodb.pem \
    && mkdir -p /data/db /home/mongod /usr/share/pmm-qa/datagen \
    && chown -R mongod:mongod /data/db /home/mongod /etc/mongodb-keyfile /etc/mongodb.pem /etc/mongodb-ca.crt \
    && dnf clean all

COPY --chown=mongod:mongod psmdb/data/ /usr/share/pmm-qa/datagen/
USER mongod
EXPOSE 27017
