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

## Notes

- A first pass with `CLIENT_VERSION=3-dev-latest` was dropped. That value
  installs the client from package repos with `microdnf` at run time, and it
  failed 3 of 6 runs on EPEL mirror 404s. Successful runs took 44–125 s, so
  they measured mirror speed rather than provisioning.
