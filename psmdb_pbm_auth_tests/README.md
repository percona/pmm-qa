# PSMDB tests

Bats suites that `PMM_PSMDB_PBM_FULL.yml` runs after pmm-framework sets up a
PSMDB stack. They talk to the PMM Server on `https://127.0.0.1:443` as
`admin:$ADMIN_PASSWORD` and `docker exec` into the PSMDB containers.

- `pbm.bats`: backup and restore through PMM, on the replica set or sharded
  cluster from [`qa-integration/pmm_psmdb-pbm_setup`](../qa-integration/pmm_psmdb-pbm_setup/README.md).
- `diffauth.bats`: adds `psmdb-server` from
  [`qa-integration/pmm_psmdb_diffauth_setup`](../qa-integration/pmm_psmdb_diffauth_setup/README.md) with
  each authentication method and checks its exporter.
- `expected_metrics.txt`: the metrics every mongodb_exporter must expose.
- `helper.bash`: the PMM API call and metrics check both suites share.

Run one locally after the matching setup:

```bash
bats -T psmdb_pbm_auth_tests/pbm.bats
```
