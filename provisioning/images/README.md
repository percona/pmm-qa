# Prebaked database framework replacement

`provisioning/setup.ts` is the single entry point replacing database paths in
`pmm-framework.py`. This directory contains its engine implementations.
It starts database nodes without Ansible or systemd, configures single,
asynchronous replication, or Group Replication topology, installs PMM Client,
registers the nodes, and runs the framework workloads.

## Requirements

- Node.js 22.18 or newer
- Docker
- A running PMM Server container, or a reachable PMM Server address

## Build

Optional: `setup.ts` builds any missing image on demand, so this is only for
pre-warming a cache. Run from the repository root:

```bash
npm run build -- mysql=8.4
npm run build -- ps=8.0
npm run build -- pxc=8.0
npm run build -- psmdb=8.0
npm run build -- mongodb=8.0
npm run build -- pgsql=18
npm run build -- pdpgsql=18
npm run build -- valkey=8
npm run build:dockerclients
```

Extra build options: `psmdb=8.0,ol-version=8`, `psmdb=8.0,patch=8.0.4-1` (pin a
full PSMDB release), `pdpgsql=18,pgsm-branch=BRANCH`, and
`pxc=8.0,image=perconalab/percona-xtradb-cluster:8.0.41` (build against a
pre-release).

Omit the version to build the defaults: MySQL `9.7`, PS `8.0`, PXC `8.0`, PSMDB `8.0`,
or PDPGSQL `18`.

MySQL supports `5.7`, `8.0`, `8.4`, and `9.7`. Percona Server supports `5.7`, `8.0`,
and `8.4`. Each engine has its own Dockerfile under `engines/`.

## Run

```bash
npm run setup
npm run setup -- --db ps=8.4
npm run setup -- --db pxc=8.0,nodes=3
npm run setup -- --db psmdb=8.0,setup-type=sharding
npm run setup -- --db pgsql=18,setup-type=replication
npm run setup -- --db pdpgsql=18,setup-type=patroni
npm run setup -- --db valkey=8,setup-type=sentinel
npm run setup -- --db ps=8.4 --db psmdb=8.0 --db pdpgsql=18
npm run setup -- --db mlaunch-psmdb=8.0,setup-type=pss
```

With no `--db`, the orchestrator starts PMM Server only. With databases selected, it
resolves PMM Client once and invokes independent engine modules. Run
`node provisioning/setup.ts --help` for the supported descriptors and shared options.

PMM agents are prepared concurrently across independent nodes. After registration,
provisioning waits for each engine's exact exporter to become ready. On failure,
sanitized container logs, PMM status, and Docker state are written to
`provisioning-artifacts/` before the command exits non-zero.

See `provisioning/ARCHITECTURE.md` for the full design and how this compares to
`qa-integration/pmm_qa/pmm-framework/`.

## Test

```bash
npm test
```

The unit tests do not require Docker.
