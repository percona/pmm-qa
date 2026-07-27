# Percona Server for MySQL — QA image (systemd), based on qa-integration/pmm_qa
#   qa-integration/pmm_qa/percona_server_for_mysql
#
# Reproduces the same container the pmm-qa Ansible framework builds, WITHOUT the
# PMM client. A single image acts as any node in three topologies, selected at
# runtime via the SETUP_TYPE env var:
#   - single       : standalone instance          (my.cnf)
#   - replication  : async replication            (my-async-replication.cnf)
#   - gr           : group replication            (my-group-replication.cnf)
#
# The entrypoint (ps-node-setup.sh, run by a systemd oneshot unit) renders the
# matching my.cnf from env vars, initializes the datadir, sets the root password,
# and wires up replication for the node's role.
#
# ---- Version selection (build args) ----
#   8.0 (default):  docker build -t ps-qa:8.0 .
#   8.4:            docker build -t ps-qa:8.4 --build-arg PS_REPO=ps-84-lts .
#   5.7:            docker build -t ps-qa:5.7 \
#                     --build-arg BASE_IMAGE=antmelekhin/docker-systemd:ubuntu-22.04 \
#                     --build-arg PS_REPO=ps-57 \
#                     --build-arg PS_PKG_SUFFIX=-5.7 .
ARG BASE_IMAGE=antmelekhin/docker-systemd:ubuntu-24.04
FROM ${BASE_IMAGE}

# ps-80 | ps-84-lts | ps-57  (percona-release channel)
ARG PS_REPO=ps-80
# "" for 8.x, "-5.7" for 5.7 package names
ARG PS_PKG_SUFFIX=

ENV DEBIAN_FRONTEND=noninteractive

# Dependencies + Percona repo + Percona Server + RocksDB + sysbench
# (mirrors prepare_install_ps.yml and the sysbench step in percona-server-setup.yml)
RUN apt-get update \
 && apt-get install -y wget gnupg2 lsb-release curl \
 && wget https://repo.percona.com/apt/percona-release_latest.generic_all.deb \
 && dpkg -i percona-release_latest.generic_all.deb \
 && rm -f percona-release_latest.generic_all.deb \
 && percona-release enable ${PS_REPO} release \
 && apt-get update \
 && apt-get install -y \
      percona-server-server${PS_PKG_SUFFIX} \
      percona-server-rocksdb${PS_PKG_SUFFIX} \
      sysbench \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY ps-node-setup.sh /usr/local/bin/ps-node-setup.sh
COPY ps-node-setup.service /etc/systemd/system/ps-node-setup.service

# Don't let mysql auto-start before the config is rendered; the setup unit starts it.
RUN chmod +x /usr/local/bin/ps-node-setup.sh \
 && systemctl disable mysql 2>/dev/null || true \
 && systemctl enable ps-node-setup.service

# 3306 = MySQL, 34061 = group replication communication (XCOM)
EXPOSE 3306 34061
