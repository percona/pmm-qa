# check=skip=InvalidDefaultArgInFrom
# HAProxy 3.4 from HAProxy Technologies' EL9 repository, built with the
# Prometheus exporter haproxy.cfg serves on :42100/metrics, on systemd.
# setup_haproxy copies that config in and installs PMM Client at run time.
# Built by build_haproxy_image in lib/images.sh.
ARG BASE_OS

FROM ${BASE_OS}

# The repository publishes no signing key, hence gpgcheck=0; it is fetched over HTTPS.
RUN set -eux; \
    printf '%s\n' '[haproxy-ha34]' 'name=HAProxy 3.4' \
      'baseurl=https://www.haproxy.com/download/haproxy/performance/rhel/ha34/el9/$basearch' \
      'gpgcheck=0' >/etc/yum.repos.d/haproxy-ha34.repo; \
    dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm; \
    dnf install -y haproxy-awslc systemd sudo iproute procps-ng findutils gzip tar; \
    dnf clean all; \
    rm -rf /var/cache/dnf; \
    haproxy -vv | grep -q prometheus-exporter

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
