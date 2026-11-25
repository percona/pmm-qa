# The official PCSM image, plus what installing PMM Client from a tarball
# needs and pkill for failover tests. setup_pcsm starts PCSM and installs PMM
# Client at run time. Built by build_pcsm_image in lib/images.sh.
ARG PCSM_VERSION

FROM percona/percona-clustersync-mongodb:${PCSM_VERSION}

USER root
RUN set -eux; \
    microdnf install -y findutils gzip procps-ng tar; \
    microdnf clean all; \
    pcsm version

ENTRYPOINT ["sleep", "infinity"]
