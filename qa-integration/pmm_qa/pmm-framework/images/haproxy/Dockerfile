# The official image's newest stable HAProxy, built with the Prometheus
# exporter haproxy.cfg serves on :42100/metrics; setup_haproxy copies that
# config in and installs PMM Client at run time.
FROM haproxy:latest

USER root
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl; \
    haproxy -vv | grep -q prometheus-exporter

ENTRYPOINT ["sleep", "infinity"]
