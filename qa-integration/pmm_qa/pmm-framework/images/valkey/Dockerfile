# check=skip=InvalidDefaultArgInFrom
# Valkey's binaries on the EL base and systemd, so setup_valkey can install a
# package PMM Client into the same container; setup_valkey runs the server as
# the valkey unit. Built by build_valkey_image in lib/images.sh.
ARG BASE_OS
ARG VALKEY_VERSION

FROM valkey/valkey:${VALKEY_VERSION}-bookworm AS valkey

FROM ${BASE_OS}
RUN dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm && \
    dnf install -y systemd sudo iproute procps-ng findutils gzip openssl tar && \
    dnf clean all && rm -rf /var/cache/dnf
COPY --from=valkey /usr/local/bin/valkey-* /usr/local/bin/
RUN valkey-server --version && valkey-cli --version
WORKDIR /data
EXPOSE 6379 16379 26379

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
