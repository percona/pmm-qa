# Valkey's binaries on an EL base, so setup_valkey can install a package PMM Client into the same container.
ARG VALKEY_VERSION=8
FROM valkey/valkey:${VALKEY_VERSION}-bookworm AS valkey

FROM oraclelinux:9
RUN dnf install -y findutils gzip openssl tar && dnf clean all && rm -rf /var/cache/dnf
COPY --from=valkey /usr/local/bin/valkey-* /usr/local/bin/
RUN valkey-server --version && valkey-cli --version
WORKDIR /data
EXPOSE 6379 16379 26379
