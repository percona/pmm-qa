# check=skip=InvalidDefaultArgInFrom
# A node with no database, on systemd: what Operations for MongoDB needs on a
# node it scans and installs MongoDB onto (python3 with venv, iproute, sudo).
# Operations installs only onto Ubuntu or Rocky Linux, hence ROCKY_IMAGE rather
# than BASE_OS. setup_empty installs PMM Client at run time. Built by
# build_empty_image in lib/images.sh.
ARG ROCKY_IMAGE

FROM ${ROCKY_IMAGE}

RUN set -eux; \
    dnf install -y systemd sudo iproute procps-ng findutils gzip tar hostname python3; \
    dnf clean all; \
    rm -rf /var/cache/dnf; \
    python3 -m venv /tmp/venv-check; \
    rm -rf /tmp/venv-check

# --privileged shows the host's ttys, where getty can fail and fail the boot.
RUN systemctl mask getty.target

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
