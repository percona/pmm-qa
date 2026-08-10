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

Run from the repository root:

```bash
npm run build -- mysql=8.4
npm run build -- ps=8.0
npm run build -- pxc=8.0
npm run build -- psmdb=8.0
npm run build -- mongodb=8.0
npm run build -- pgsql=18
npm run build -- pdpgsql=18
npm run build -- valkey=8
```

Omit the version to build the defaults: MySQL `8.4`, PS `8.4`, PXC `8.0`, PSMDB `8.0`,
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
```

With no `--db`, the orchestrator starts PMM Server only. With databases selected, it
resolves PMM Client once and invokes independent prebaked engine modules. Run
`node provisioning/setup.ts --help` for the supported descriptors and shared options.

## Test

```bash
npm test
```

The unit tests do not require Docker.
