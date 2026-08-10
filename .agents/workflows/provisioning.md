---
description: Quick reference for independent prebaked PMM provisioning
---

# Provisioning

Use this reference without reading `provisioning/setup.ts`; inspect the implementation only
when this document conflicts with runtime behavior or a command fails unexpectedly.

```powershell
npm run build -- ps=8.4
node provisioning/setup.ts --db ps=8.4 --db psmdb=8.0,setup-type=sharding
node provisioning/setup.ts --teardown
```

Build each required image once with `npm run build -- <descriptor>`. Repeat `--db` for distinct
targets; omit it for PMM Server only.

| Descriptor | Versions | Options |
|---|---|---|
| `mysql` | 5.7, 8.0, 8.4, 9.7 | `setup-type=single|replication|gr`, `nodes`, `query-source=perfschema|slowlog`, workload, TLS |
| `ps` | 5.7, 8.0, 8.4 | MySQL options plus MyRocks, backup, buckets |
| `pxc` | 5.7, 8.0 | 3+ nodes with ProxySQL, query source, workload |
| `psmdb` | 6.0, 7.0, 8.0, latest=8.0 | `setup-type=pss|psa|sharding`, `storage-engine=wiredTiger|inMemory`, `replica-sets=1|2`, `ol-version=8|9`, TLS, GSSAPI, PBM |
| `mongodb` | 6.0, 7.0, 8.0 | `setup-type=pss|psa|sharding`, TLS |
| `pgsql` | 16, 17, 18 | `setup-type=single|replication`, nodes, TLS, pg_stat_statements |
| `pdpgsql` | 16, 17, 18 | `setup-type=single|replication|patroni`, nodes, TLS, pg_stat_monitor |
| `valkey` | 7, 8 | `setup-type=cluster|sentinel` |
| `haproxy` | latest | fronts same-run PS/PXC targets on `:3306`; otherwise metrics-only |
| `external` | latest | Redis and process exporters |
| `bucket` | latest | MinIO; `buckets=bcp;archive` |

Global flags: `--server-image`, `--pmm-server HOST[:PORT]`, `--admin-password`,
`--client-version`, `--metrics-mode`, `--client-debug`, `--encrypted-client-config`.
Defaults: server `perconalab/pmm-server:3-dev-latest`, password `admin`, client
`latest-tarball`, metrics mode `auto`; ready URL `https://localhost:443`.
TLS accepts `tls=true` or `ssl_<engine>` aliases. Feature clients require a tarball URL.

## Remaining gaps versus pmm-framework

- `DOCKERCLIENTS` is not ported; every prebaked target already installs PMM Client directly.
- The same target/topology cannot be repeated for multiple versions in one run.
- Custom `PGSM_BRANCH` source builds are not ported; PDPGSQL images use the packaged pg_stat_monitor build.
