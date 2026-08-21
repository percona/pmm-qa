# pmm-framework — setup inventory

Every database type and meaningful variant exposed via `--database`.
Format: `pmm-framework --database <TYPE>[,SETUP_TYPE=<variant>][,<OPTION>=<value>]`

## MongoDB / PSMDB family

| # | Command | Script / playbook | Notes |
|---|---------|-------------------|-------|
| 1 | `psmdb` | `start-rs-only.sh` | Default `SETUP_TYPE=pss` |
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
| 17 | `ps,SETUP_TYPE=multi_source` | same | Multi-master GTID mesh (3 nodes, named channels) |
| 18 | `ps,BACKUP=true` | same + backup_setup | XtraBackup + MinIO |
| 19 | `ssl_mysql` | `tls-ssl-setup/mysql_tls_setup.yml` | TLS MySQL |

## PostgreSQL family

| # | Command | Playbook | SETUP_TYPE variants |
|---|---------|----------|---------------------|
| 20 | `pgsql` | `pgsql_pgss_setup.yml` | single + pg_stat_statements |
| 21 | `pgsql,SETUP_TYPE=replication` | `postgresql/postgresql-setup.yml` | Primary + replica |
| 22 | `pdpgsql` | `percona-distribution-postgresql/...` | single (default) |
| 23 | `pdpgsql,SETUP_TYPE=replication` | same | Streaming replication |
| 24 | `pdpgsql,SETUP_TYPE=patroni` | same | Patroni HA |
| 25 | `ssl_pdpgsql` | `tls-ssl-setup/postgresql_tls_setup.yml` | TLS PostgreSQL |

## Proxy / external / infra

| # | Command | Playbook / script | Notes |
|---|---------|-------------------|-------|
| 26 | `pxc` | `pxc_proxysql_setup.yml` | PXC + ProxySQL |
| 27 | `haproxy` | `haproxy_setup.yml` | HAProxy frontend |
| 28 | `external` | `external_setup.yml` | Redis + Node exporter |
| 29 | `dockerclients` | `setup_docker_client_images.sh` | Client docker images |
| 30 | `bucket` | `tasks/create_minio_container.yml` | MinIO backup bucket |
| 31 | `valkey` | `valkey/valkey-cluster.yml` | Cluster (default) |
| 32 | `valkey,SETUP_TYPE=sentinel` | `valkey/valkey-sentinel.yml` | Sentinel HA |
