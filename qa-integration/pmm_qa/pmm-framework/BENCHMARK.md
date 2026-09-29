# Prebaked-image benchmark

Time to provision each spec against an already-running PMM Server, on a local
WSL2 Ubuntu host with Docker Desktop (14 CPUs, 15 GB), with
`CLIENT_VERSION=latest-tarball` as CI passes. "Old" is the Ansible and compose
path it replaced, run from a clean copy of the branch it was ported from.
"Prebaked" is the current path with the image already pulled.

| Spec | Old | Prebaked |
|---|---|---|
| `ps=8.4` | 151 s | 23 s |
| `ps=8.4,SETUP_TYPE=replication` | 282 s | 24 s |
| `ps=8.4,SETUP_TYPE=gr` | 406 s | 43 s |
| `mysql` / `replication` / `gr` | – | 20 s / 28 s / 33 s |
| `ssl_mysql=8.4` | 125 s | 24 s |
| `pxc=8.0` | 243 s | 65 s |
| `psmdb,SETUP_TYPE=pss` | 283 s | 47 s |
| `psmdb,SETUP_TYPE=psa` | 282 s | 48 s |
| `psmdb,SETUP_TYPE=pss,COMPOSE_PROFILES=extra` | 358 s | 76 s |
| `psmdb=8.0,SETUP_TYPE=sharding` | 495 s | 157 s |
| `ssl_psmdb` | – | 77 s |
| `pgsql` | 174 s | 13 s |
| `pgsql,SETUP_TYPE=replication` | 719 s | 29 s |
| `pdpgsql` | 511 s | 18 s |
| `pdpgsql,SETUP_TYPE=patroni` | 1,427 s | 64 s |
| `ssl_pdpgsql` | 158 s | 25 s |
| `haproxy` | 222 s | 19 s |
| `external` | 115 s | 19 s |
| `valkey` / `SETUP_TYPE=sentinel` | 244 s / 233 s | 62 s / 66 s |

Every prebaked run ended with each node's exporters and node_exporter Running,
and the service names and labels read back from `/v1/management/services`
matched the old path's.

- **Workload.** The old PS playbook waited for sysbench to finish; the prebaked
  path starts it in the background. Timed until sysbench exits, prebaked is
  still 2.3× faster for single PS, 3.4× for replication and 4.5× for GR.
- **Package clients.** `CLIENT_VERSION=3-dev-latest` installs from
  repo.percona.com at run time, which adds 20–90 s and depends on mirror speed
  (PSMDB pss: 140 s).
- **Cold images.** A first run without a pulled image builds it: 90–160 s.
