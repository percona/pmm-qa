# check=skip=InvalidDefaultArgInFrom
# redis_exporter and process-exporter on systemd for setup_external, which
# starts them and installs PMM Client at run time. Built by
# build_external_image in lib/images.sh.
ARG BASE_OS

FROM ${BASE_OS}
ARG REDIS_EXPORTER_VERSION
ARG PROCESS_EXPORTER_VERSION

RUN set -eux; \
    : "${REDIS_EXPORTER_VERSION:?REDIS_EXPORTER_VERSION build-arg is required}"; \
    : "${PROCESS_EXPORTER_VERSION:?PROCESS_EXPORTER_VERSION build-arg is required}"; \
    dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm; \
    dnf install -y systemd sudo iproute procps-ng findutils gzip tar; \
    dnf clean all; \
    rm -rf /var/cache/dnf; \
    arch=$(uname -m | sed 's/x86_64/amd64/; s/aarch64/arm64/'); \
    curl -fsSL "https://github.com/oliver006/redis_exporter/releases/download/v${REDIS_EXPORTER_VERSION}/redis_exporter-v${REDIS_EXPORTER_VERSION}.linux-${arch}.tar.gz" \
        | tar -xz -C /usr/local/bin --strip-components=1 --wildcards '*/redis_exporter'; \
    curl -fsSL "https://github.com/ncabatoff/process-exporter/releases/download/v${PROCESS_EXPORTER_VERSION}/process-exporter-${PROCESS_EXPORTER_VERSION}.linux-${arch}.tar.gz" \
        | tar -xz -C /usr/local/bin --strip-components=1 --wildcards '*/process-exporter'; \
    redis_exporter --version; \
    process-exporter --version

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
