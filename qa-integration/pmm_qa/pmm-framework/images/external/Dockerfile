# redis_exporter and process-exporter for setup_external, which starts them
# and installs PMM Client at run time.
FROM oraclelinux:9

ARG REDIS_EXPORTER_VERSION=1.58.0
ARG PROCESS_EXPORTER_VERSION=0.7.10

RUN set -eux; \
    dnf install -y findutils gzip tar; \
    dnf clean all; \
    rm -rf /var/cache/dnf; \
    curl -fsSL "https://github.com/oliver006/redis_exporter/releases/download/v${REDIS_EXPORTER_VERSION}/redis_exporter-v${REDIS_EXPORTER_VERSION}.linux-amd64.tar.gz" \
        | tar -xz -C /usr/local/bin --strip-components=1 --wildcards '*/redis_exporter'; \
    curl -fsSL "https://github.com/ncabatoff/process-exporter/releases/download/v${PROCESS_EXPORTER_VERSION}/process-exporter-${PROCESS_EXPORTER_VERSION}.linux-amd64.tar.gz" \
        | tar -xz -C /usr/local/bin --strip-components=1 --wildcards '*/process-exporter'; \
    redis_exporter --version; \
    process-exporter --version

ENTRYPOINT ["sleep", "infinity"]
