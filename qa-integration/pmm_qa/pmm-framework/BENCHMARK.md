# Prebaked-image benchmark

Wall-clock time to provision PS 8.4 against an already-running PMM Server
(`perconalab/pmm-server:3-dev-latest` on the `pmm-qa` network), measured on a
local WSL2 Ubuntu host with Docker Desktop (14 CPUs, 15 GB). Each cell is the
median of 3 runs, with `ps_pmm*` containers removed between runs, and
`CLIENT_VERSION=latest-tarball`, which is what CI passes.

| Shape | A: TS `provisioning/` | B: pmm-framework (Ansible) | C: pmm-framework (prebaked) |
|---|---|---|---|
| `ps=8.4` | 28.4 s | 151.1 s | 23.0 s |
| `ps=8.4,SETUP_TYPE=replication` | 38.6 s | 282.4 s | 24.4 s |
| `ps=8.4,SETUP_TYPE=gr` | 54.6 s | 406.3 s (1 run) | 43.0 s |

Column C timings:
- Single: 25.3, 19.5, 23.0 s
- Replication: 26.7, 23.9, 24.4 s
- GR: 43.0, 44.5, 38.3 s

The first GR set ran before a fix and took 34.4, 34.4 and 34.4 s, with the
third run failing. PMM Server answered all three `pmm-admin add mysql` calls
with `failed to get connection service info: timeout (context deadline
exceeded)`, and registration only retried on `pmm-agent is not connected`. The
GR timings above were taken after adding that error to the retry.

Column A passed 9 of 9 runs. The first single run (47.5 s) also downloaded the
client tarball into the cache.

Column B ran the unmodified framework, taken from `HEAD` with `git archive`.
It passed all 7 runs, after one uncounted warm-up run (160.8 s) that pulled
the systemd base image and the Ansible collections.
- Single: 168.8, 142.2, 151.1 s
- Replication: 318.8, 282.4, 281.0 s
- GR: stopped after its first run, on request.

One-off cold image build (`pmm-qa/ps:8.4`): 123 s.

## Waiting for the workload too

Columns A and C return while sysbench is still preparing and running, but the
playbook (B) waits for it. The CI PS specs below ran once each on the prebaked
path, and this time the clock also ran until sysbench exited, which is the fair
comparison with B. They ran after `--innodb-monitor-enable=all` and (for 8.4)
`--mysql-native-password=ON` were added, matching the playbook's `my.cnf`.

| Spec | Setup | Setup + workload | Checked |
|---|---|---|---|
| `ps=8.4` | 26.6 s | 66.2 s | 8.4.10-10, 318 InnoDB metrics on, native auth ACTIVE |
| `ps=5.7` | 22.1 s | 56.1 s | 5.7.44-48 |
| `ps=8.0` | 21.2 s | 65.4 s | 8.0.46-37 |
| `ps=9.7` | 17.5 s | 52.4 s | 9.7.1-1, no native auth (removed in 9.x) |
| `ps,QUERY_SOURCE=slowlog` | 17.6 s | 55.6 s | `slow_query_log=1` |
| `ps,SETUP_TYPE=replication,MY_ROCKS=true` | 32.7 s | 81.8 s | ROCKSDB=YES on both nodes |
| `ps,SETUP_TYPE=gr,QUERY_SOURCE=slowlog` | 45.0 s | 89.5 s | 3 nodes, slowlog on all |
| `ps,ENCRYPTED_CLIENT_CONFIG=true` | 22.8 s | 61.0 s | `pmm-key.pem` present |
| `ps,BACKUP=true` | 20.5 s | 54.4 s | MinIO bucket `bcp`, xtrabackup 8.4.0-2 |

Every node registered with `mysqld_exporter` Running, and sysbench exited 0
each time. Even with the wait, the prebaked path is about 2.3× faster than B
for single, 3.4× for replication and 4.5× for GR.

## MySQL (upstream) on the prebaked path

Each spec ran once, with `CLIENT_VERSION=latest-tarball`, timed the same way
as the PS specs above. The labels were read back from `/v1/management/services`.

| Spec | Setup | Setup + workload | Checked |
|---|---|---|---|
| `mysql` | 20.0 s | 84.0 s | 8.4.11, `mysql-dev` / `mysql-single-dev-cluster` |
| `mysql=5.7` | 16.9 s | 81.7 s | 5.7.44, host port published (unlike PS 5.7) |
| `mysql=8.0` | 19.6 s | 91.6 s | 8.0.46 |
| `mysql=9.7` | 21.9 s | 86.4 s | 9.7.2 |
| `mysql,SETUP_TYPE=replication` | 28.0 s | 94.7 s | `mysql-replication-dev` / `mysql-async-replication` |
| `mysql,SETUP_TYPE=gr,QUERY_SOURCE=slowlog` | 33.4 s | 102.9 s | 3 nodes, `mysql-gr-replication`, slowlog on all |

MySQL's workload runs longer than PS's because its playbook runs sysbench for
60 s rather than 30 s.

With the `3-dev-latest` package client:
- `mysql=8.4` passed in 82.3 s. The package install from repo.percona.com is
  the slow part, and on the first try it failed on a mirror's
  `Inconsistent server data`, so installs now retry on repo errors.
- `mysql=5.7` is refused in about 9 s with "PMM 3 Client packages are not
  published for EL7; use a tarball CLIENT_VERSION." `mysql:5.7` is EL7, where
  `yum` would otherwise quietly install a PMM 2 client (117 s) that cannot
  register. No CI job runs MySQL 5.7 with a package client.

## PXC on the prebaked path

This is one container, `pxc_proxysql_pmm_<ver>`, built from `images/pxc`: 3
nodes on 127.0.0.1:3306-3308, ProxySQL on 6032/6033 and one pmm-agent. That is
the same layout the playbook produced. `CLIENT_VERSION=latest-tarball`.

| `pxc=8.0` | TS `provisioning/` | pmm-framework (Ansible) | pmm-framework (prebaked) |
|---|---|---|---|
| Time | 119.7 s (median of 3) | 242.9 s (1 run) | 63.3 s / 67.7 s / 65.3 s |

The TypeScript tool uses separate containers (`pxc_pmm_1..3`, `pxc-proxy`),
which the tests do not expect.

| Spec | Time | Checked |
|---|---|---|
| `pxc=5.7` | 55.6 s | 5.7.44-48-57, ProxySQL 2.7.3 |
| `pxc=8.0` | 65.3 s | 8.0.46-38.1, ProxySQL 2.7.3 |
| `pxc=8.4` | 62.8 s | 8.4.10-10.1, ProxySQL 3.0.11 |
| `pxc=9.7` | 66.1 s | 9.7.1-1.1, ProxySQL 3.0.11 |
| `pxc=8.4,QUERY_SOURCE=slowlog` | 63.9 s | `slow_query_log=1` on all 3 nodes |
| `pxc=8.0` with `CLIENT_VERSION=3-dev-latest` | 86.7 s | package client install |

Every run had these, matching the playbook:
- all 3 nodes `Synced`, cluster size 3
- ProxySQL Galera hostgroups 10/11/12, with a query through 6033 as `proxysql_user`
- services `pxc_node__1..3_<n>` with `pxc-dev` / `pxc-dev-cluster` / `pxc-repl`
- `my-new-proxysql_<container>_<n>` with every exporter Running
- the continuous sysbench read-only and read-write load

Two differences from the playbook: the Percona package is ProxySQL 2.7.3, not
the playbook's pinned 2.6.2, and the image build (`build-images
pxc-proxysql=<ver>`) takes about 90 s the first time.

## PSMDB on the prebaked path

The same containers as before (`pmm_psmdb-pbm_setup`'s compose files, now
running `pmm-qa/psmdb:<major>-ol<N>` tagged as `replica_member/local`), one run
each, with `CLIENT_VERSION=latest-tarball`. The old path rebuilt the image with
`--no-cache` on every run and slept 60 s after each step; it was timed from a
clean `git archive HEAD` copy.

| Spec | Old (compose scripts) | Prebaked | Checked |
|---|---|---|---|
| `psmdb,SETUP_TYPE=pss` | 283 s | 47 s / 59 s | rs101 PRIMARY, 3 pbm-agents OK, S3 storage `minio:9000/bcp/pbme2etest` |
| `psmdb,SETUP_TYPE=psa` | 282 s | 48 s | rs103 ARBITER, its pbm-agent stopped |
| `psmdb,SETUP_TYPE=pss,COMPOSE_PROFILES=extra` | 358 s | 76 s | both sets PRIMARY/SECONDARY/SECONDARY |
| `psmdb=8.0,SETUP_TYPE=sharding` | 495 s | 157 s | shards rs1 and rs2 added, 10 nodes' exporters Running |
| `psmdb,SETUP_TYPE=pss,STORAGE_ENGINE=inmemory` | – | 62 s | |
| `psmdb,OL_VERSION=8,GSSAPI=true` | – | 54 s | `rs10N_gssapi_*` registered over Kerberos |
| `psmdb,COMPOSE_PROFILES=extra,OL_VERSION=8,GSSAPI=true` | – | 77 s | |
| `psmdb,OL_VERSION=9,GSSAPI=true` | – | 71 s | |
| `psmdb,COMPOSE_PROFILES=extra,OL_VERSION=9,GSSAPI=true` | – | 76 s | |
| `ssl_psmdb` | – | 77 s | psmdb-server PRIMARY, `psmdb-server_*` in `mycluster` |
| `psmdb,SETUP_TYPE=pss` with `3-dev-latest` | – | 140 s | package client install is the slow part |

Every run gave each container its own machine ID, and the labels read back
from `/v1/management/services` matched the old scripts': `psmdb-dev` /
`replicaset` / `rs` for the first set, no environment for the extra set,
`mongo-sharded-dev` / `sharded` / `rs1`, `rs2`, `rscfg` for the shards, and
none but the cluster for mongos.

- GSSAPI needs the client CI passes for it,
  `PR-BUILDS/pmm-client/pmm-client-dynamic-ol<N>-latest.tar.gz`; the plain
  `latest-tarball` client is built without `-tags gssapi` and refuses to
  register.
- `psmdb=7.0,SETUP_TYPE=sharding` took 221 s including the one-off 7.0 image
  build. A cold image build is 91-95 s.

## HAProxy and SSL MySQL on the prebaked path

One run each, `CLIENT_VERSION=latest-tarball`, old path timed from a clean `git archive HEAD` copy.

| Spec | Old | Prebaked | Checked |
|---|---|---|---|
| `haproxy` | 222 s | 19 s / 11 s | 393 `haproxy_*` series on host :42100, `--environment=haproxy`, annotate works |
| `ssl_mysql=8.4` | 125 s | 24 s | plain TCP refused (`require_secure_transport`), TLS cipher negotiated, slow log on, certs copied to `tls-ssl-setup/mysql/8.4/` |
| `ssl_mysql=5.7` / `8.0` / `9.7` | – | 25 s / 19 s / 29 s | same checks |

The old HAProxy path compiled HAProxy's git master on every run; the image is
Oracle Linux 9's `haproxy` 2.8 package, which has the Prometheus exporter.
With setup that fast, PMM-T2103 opened its dashboard before the rate panels had
data, so it now auto-refreshes and waits, as PMM-T324 does.
## External and Valkey on the prebaked path

One run each, `CLIENT_VERSION=latest-tarball`, old path from a clean `git archive HEAD` copy.

| Spec | Old | Prebaked | Checked |
|---|---|---|---|
| `external` | 115 s | 19 s | PMM Server scrapes `external_pmm:42200`, `redis_up 1`; both services registered |
| `valkey` (cluster) | 244 s | 62 s | `cluster_state:ok`, 6 nodes, `<name>-svc` / `<name>-node`; CLI `@valkey` 4/4 |
| `valkey,SETUP_TYPE=sentinel` | 233 s | 66 s | 2 replicas connected, sentinel quorum OK |
| `valkey=7` | – | 64 s | Valkey 7.2.10 |

The old External path ended up running redis_exporter 1.14.0 (32-bit): it installed
twice and the second copy landed inside the first one's directory. The image runs
the 1.58.0 the framework asks for.
## PDPGSQL on the prebaked path

One run each, `CLIENT_VERSION=latest-tarball`, PostgreSQL 17 unless noted.

| Spec | Old | Prebaked | Checked |
|---|---|---|---|
| `pdpgsql` | 511 s | 18 s | TCP and socket services, pg_stat_monitor collecting; CLI `@pdpgsql` 11/12 (PMM-T1828 reads the host's `ps`, which only a Linux CI runner shows) |
| `pdpgsql,SETUP_TYPE=patroni` | 1427 s | 64 s | 3 members running under one leader, Patroni API services registered |
| `pdpgsql,SETUP_TYPE=replication` | – | 31 s | replica streaming, `test_slot` present |
| `pdpgsql=14` / `15` / `16` / `18` | – | 29 s / 15 s / 15 s / 15 s | same checks; CLI `@pdpgsql` 11/12 each |
| `pdpgsql`, `CLIENT_VERSION=3-dev-latest` / `3.9.1` | – | 38 s / 35 s | Debian package installed; `3.9.1` with `ENCRYPTED_CLIENT_CONFIG=true` |

The image is the playbook's systemd Ubuntu 24.04 with every package baked in,
since tests restart PostgreSQL through `service` and read `/var/log/postgresql`.
Replication first took 143 s: `pg_basebackup` waited out a spread checkpoint,
so it now asks for a fast one.
## PGSQL on the prebaked path

| Spec | Old | Prebaked | Checked |
|---|---|---|---|
| `pgsql` | 174 s | 13 s | `service postgresql restart` after `ALTER SYSTEM`, pg_stat_statements populated, load running, `/pmm-agent.log` written |
| `pgsql,SETUP_TYPE=replication` | 719 s | 29 s | replica streaming, services named `pgsql_pmm_17_<n>` as on a fresh server |

The default image runs the playbook's own `pg_stat_statements_setup.sh` at
build time. Replication runs the official `postgres` image the playbook used,
cloning the replica before its first start instead of through a host data
directory, and leaves the `pgbench` load running rather than waiting out its
120 s. With no host data directory left, PDPGSQL and replication PGSQL only
clash when PDPGSQL runs Patroni, on host port 6432.
## SSL PDPGSQL on the prebaked path

| Spec | Old | Prebaked | Checked |
|---|---|---|---|
| `ssl_pdpgsql=16` | 158 s (17) | 25 s | service registered over TLS; PMM Server connects with the copied client certificate, CA verified, TLSv1.3 |

The image drops the certificates its build made, so none is published; each
container makes its own at start, as the playbook's did.
## Notes

- A first pass with `CLIENT_VERSION=3-dev-latest` was dropped. That value
  installs the client from package repos with `microdnf` at run time, and it
  failed 3 of 6 runs on EPEL mirror 404s. Successful runs took 44–125 s, so
  they measured mirror speed rather than provisioning.
