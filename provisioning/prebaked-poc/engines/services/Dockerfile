FROM rockylinux:9
ARG REDIS_EXPORTER_VERSION=1.58.0
ARG PROCESS_EXPORTER_VERSION=0.7.10
RUN dnf install -y findutils gzip haproxy openssl tar \
    && ln -s /usr/bin/dnf /usr/bin/microdnf \
    && curl -fL "https://github.com/oliver006/redis_exporter/releases/download/v${REDIS_EXPORTER_VERSION}/redis_exporter-v${REDIS_EXPORTER_VERSION}.linux-amd64.tar.gz" -o /tmp/redis.tar.gz \
    && tar -xzf /tmp/redis.tar.gz -C /tmp \
    && mv "/tmp/redis_exporter-v${REDIS_EXPORTER_VERSION}.linux-amd64/redis_exporter" /usr/local/bin/redis_exporter \
    && curl -fL "https://github.com/ncabatoff/process-exporter/releases/download/v${PROCESS_EXPORTER_VERSION}/process-exporter-${PROCESS_EXPORTER_VERSION}.linux-amd64.tar.gz" -o /tmp/process.tar.gz \
    && tar -xzf /tmp/process.tar.gz -C /tmp \
    && mv "/tmp/process-exporter-${PROCESS_EXPORTER_VERSION}.linux-amd64/process-exporter" /usr/local/bin/process-exporter \
    && rm -rf /tmp/*.tar.gz /tmp/redis_exporter-* /tmp/process-exporter-* \
    && dnf clean all
COPY haproxy.cfg /etc/haproxy/haproxy.cfg
EXPOSE 42100 42200 9256
