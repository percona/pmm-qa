# HAProxy from the Oracle Linux package, which is built with the Prometheus
# exporter haproxy.cfg serves on :42100/metrics; setup_haproxy copies that
# config in and installs PMM Client at run time.
FROM oraclelinux:9

RUN set -eux; \
    dnf install -y haproxy findutils gzip tar; \
    dnf clean all; \
    rm -rf /var/cache/dnf; \
    haproxy -vv | grep -q prometheus-exporter

ENTRYPOINT ["sleep", "infinity"]
