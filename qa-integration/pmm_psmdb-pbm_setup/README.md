# PSMDB with PBM

Compose stacks for the `PSMDB` setup of
[pmm-framework](../pmm_qa/pmm-framework/README.md). Run them through it, not
by hand: it builds the images, starts the stack and registers every member
with PMM.

- `docker-compose-rs.yaml`: a replica set (rs101-rs103), plus a second one
  (rs201-rs203) with `COMPOSE_PROFILES=extra`, the Kerberos KDC, MinIO and the
  PBM agents.
- `docker-compose-sharded.yaml`: two shards, a config replica set, `mongos`
  and the `chunk-churn` service that keeps chunks moving.
- `docker-compose-pmm.yaml`: a PMM Server on 443, for
  `PMM_PSMDB_PBM_FULL.yml`.
- `conf/`: the mongod, mongos, PBM and datagen config the containers mount;
  `keyfile` and `conf/sysconfig`, `conf/krb`, `conf/mongos/mongos.service` are
  baked into the `psmdb` image, which builds with this folder as its context.
- `generate_opcountersrepl_traffic.sh`: replication traffic for the sharded
  cluster, run by the framework after setup.

The tests for this stack are in [`psmdb_pbm_auth_tests`](../../psmdb_pbm_auth_tests/README.md).
