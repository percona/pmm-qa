# pmm-framework.py — setup inventory (MicroVM target)

Every database type and meaningful variant exposed via `--database`.  
Format: `python pmm-framework.py --database <TYPE>[,SETUP_TYPE=<variant>][,<OPTION>=<value>]`

## MongoDB / PSMDB family

| # | Command | Script / playbook | Notes |
|---|---------|-------------------|-------|
| 1 | `psmdb` | `start-rs-only.sh` / `start-rs-only-microvm.sh` | Default `SETUP_TYPE=pss` |
| 2 | `psmdb,SETUP_TYPE=psa` | same | PSA replica set |
| 3 | `psmdb,SETUP_TYPE=sharding` | `start-sharded.sh` | Sharded cluster + PBM |
| 4 | `psmdb,SETUP_TYPE=pss,COMPOSE_PROFILES=extra` | same + extra RS | Second replica set |
| 5 | `psmdb,SETUP_TYPE=pss,STORAGE_ENGINE=inmemory` | same | In-memory storage |
| 6 | `psmdb,SETUP_TYPE=pss,GSSAPI=true` | same | Kerberos (heavy) |
| 7 | `mlaunch_psmdb` | `mlaunch_psmdb_setup.yml` | mlaunch-based, no PBM |
| 8 | `mlaunch_modb` | `mlaunch_modb_setup.yml` | Community Mongo via mlaunch |
| 9 | `ssl_psmdb` | `pmm_psmdb_diffauth_setup` | TLS + diff auth |
| 10 | `ssl_mlaunch` | `mlaunch_tls_setup.yml` | mlaunch + TLS |

## MySQL family

| # | Command | Playbook | SETUP_TYPE variants |
|---|---------|----------|---------------------|
| 11 | `mysql` | `mysql/mysql-setup.yml` | single (default `""`) |
| 12 | `mysql,SETUP_TYPE=gr` | same | Group Replication (3 nodes) |
| 13 | `mysql,SETUP_TYPE=replication` | same | Async replication (2 nodes) |
| 14 | `ps` | `percona_server_for_mysql/percona-server-setup.yml` | single (default) |
| 15 | `ps,SETUP_TYPE=gr` | same | Group Replication |
| 16 | `ps,SETUP_TYPE=replication` | same | Async replication |
| 17 | `ps,BACKUP=true` | same + backup_setup | XtraBackup + MinIO |
| 18 | `ssl_mysql` | `tls-ssl-setup/mysql_tls_setup.yml` | TLS MySQL |

## PostgreSQL family

| # | Command | Playbook | SETUP_TYPE variants |
|---|---------|----------|---------------------|
| 19 | `pgsql` | `pgsql_pgss_setup.yml` | single + pg_stat_statements |
| 20 | `pgsql,SETUP_TYPE=replication` | `postgresql/postgresql-setup.yml` | Primary + replica |
| 21 | `pdpgsql` | `percona-distribution-postgresql/...` | single (default) |
| 22 | `pdpgsql,SETUP_TYPE=replication` | same | Streaming replication |
| 23 | `pdpgsql,SETUP_TYPE=patroni` | same | Patroni HA |
| 24 | `ssl_pdpgsql` | `tls-ssl-setup/postgresql_tls_setup.yml` | TLS PostgreSQL |

## Proxy / external / infra

| # | Command | Playbook / script |
|---|---------|-------------------|
| 25 | `pxc` | `pxc_proxysql_setup.yml` | PXC + ProxySQL |
| 26 | `haproxy` | `haproxy_setup.yml` | HAProxy frontend |
| 27 | `external` | `external_setup.yml` | Redis + Node exporter |
| 28 | `dockerclients` | `setup_docker_client_images.sh` | Client docker images |
| 29 | `bucket` | `tasks/create_minio_container.yml` | MinIO backup bucket |
| 30 | `valkey` | `valkey/valkey-cluster.yml` | Cluster (default) |
| 31 | `valkey,SETUP_TYPE=sentinel` | `valkey/valkey-sentinel.yml` | Sentinel HA |

## MicroVM env

Set **`IS_CURSOR_VM=1`** in Cursor automation secrets (one variable for the whole MicroVM QA path).
`PMM_QA_NO_SYSTEMD` and other internal flags are derived automatically.
Batch runners default `IS_CURSOR_VM=1` when unset.

```bash
export IS_CURSOR_VM=1
export ADMIN_PASSWORD='pmm3admin!'
export CLIENT_VERSION='<tarball-url>'
```

## MicroVM verification status (2026-07-03)

Requires only `IS_CURSOR_VM=1` (set in Cursor automation secrets).

| Setup | Status | Notes |
|-------|--------|-------|
| `psmdb,SETUP_TYPE=pss` | PASS | `start-rs-only-microvm.sh` |
| `psmdb,SETUP_TYPE=psa` | PASS | same microvm RS path |
| `psmdb,SETUP_TYPE=sharding` | PASS | `start-sharded-microvm.sh` |
| `dockerclients` | PASS | |
| `ps` (single) | PASS | Ubuntu base + `mysqld --daemonize` |
| `ps,SETUP_TYPE=gr` | PASS | |
| `ps,SETUP_TYPE=replication` | PASS | |
| `mysql` (single) | PASS | |
| `mysql,SETUP_TYPE=gr` | PASS | multi-node prepare_install fix |
| `mysql,SETUP_TYPE=replication` | PASS | |
| `bucket` | PASS | |
| `haproxy` | PASS | |
| `external` | PASS | cleanup shell fix |
| `valkey` | PASS | |
| `valkey,SETUP_TYPE=sentinel` | PASS | |
| `pgsql` | PASS | |
| `pgsql,SETUP_TYPE=replication` | PASS | fixed conf paths + data cleanup |
| `pdpgsql` | PASS | removed invalid `become` on include_tasks |
| `pdpgsql,SETUP_TYPE=replication` | PASS | |
| `pdpgsql,SETUP_TYPE=patroni` | PASS | sequential patroni + socket lock cleanup |
| `ssl_mysql` | PASS | |
| `ssl_pdpgsql` | PASS | |
| `mlaunch_psmdb` | PASS | |
| `mlaunch_modb` | PASS | |
| `pxc` | PASS | xtrabackup-80 + umask 022 for node cnf |
| `ssl_psmdb` | PASS | docker-compose microvm override |
| `ssl_mlaunch` | PASS | community MongoDB 8.0 tarball + mongosh TLS |
