ARG VALKEY_VERSION=8
FROM valkey/valkey:${VALKEY_VERSION}-bookworm AS valkey

FROM rockylinux:9
RUN dnf install -y findutils gzip openssl tar \
    && ln -s /usr/bin/dnf /usr/bin/microdnf \
    && dnf clean all \
    && useradd -r -u 999 valkey \
    && mkdir -p /data \
    && chown valkey:valkey /data
COPY --from=valkey /usr/local/bin/valkey-* /usr/local/bin/
USER valkey
WORKDIR /data
EXPOSE 6379 16379 26379
