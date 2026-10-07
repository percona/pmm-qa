# Bash PMM Framework

`pmm-framework` provisions databases on prebaked Docker images, installs PMM
Client in them and registers them with a PMM Server, so CI jobs and local runs
get the containers and services the CLI, E2E and CodeceptJS tests expect.

> **Changing the code?** See [ARCHITECTURE.md](ARCHITECTURE.md).

## Requirements

- Bash 5.1 or newer
- Docker with the Compose v2 plugin (2.24 or newer for `SSL_PSMDB`, which uses
  Compose's `!reset` override tag)
- `curl`
- A running PMM Server container, or an explicit `--pmm-server-ip`

On macOS, ensure Homebrew Bash precedes `/bin/bash` in `PATH`; Apple's bundled
Bash 3.2 is unsupported.

Images are pulled from `ghcr.io/percona/pmm-qa`, or built locally from
`images/<image>/Dockerfile` when the pull fails, with a warning saying why.
A local copy is reused without checking the registry; set `PREBAKED_PULL=always`
to pull the latest published image anyway, e.g. on a long-lived machine. Set
`PREBAKED_REGISTRY=` to always build locally, e.g. to try a Dockerfile change,
or prebake them with `./build_images ps=8.4 pdpgsql=17`.

PS and MySQL keep the official database container unprivileged. Their
`pmm-agent` runs there too, unless `--nomad` is passed; then it runs in a
companion container that shares the database container's
network, PID namespace, PMM installation, data volumes and temporary files.
Only that companion receives the host cgroup access Nomad needs, so Nomad
cannot interfere with mysqld initialization or lifetime.

## Usage

Run from any working directory:

```bash
qa-integration/pmm_qa/pmm-framework/pmm-framework \
  --database ps=8.4
```

Use an external PMM Server:

```bash
qa-integration/pmm_qa/pmm-framework/pmm-framework \
  --pmm-server-ip 192.0.2.10 \
  --pmm-server-password admin \
  --client-version 3-dev-latest \
  --database pgsql=17,SETUP_TYPE=replication
```

Set up multiple databases sequentially:

```bash
qa-integration/pmm_qa/pmm-framework/pmm-framework \
  --database ps=8.4,SETUP_TYPE=gr \
  --database psmdb=8.0,SETUP_TYPE=sharding,GSSAPI=true \
  --database valkey=8,SETUP_TYPE=sentinel
```

Run independent setups concurrently:

```bash
qa-integration/pmm_qa/pmm-framework/pmm-framework \
  --parallel \
  --database ps=8.4 \
  --database pgsql=17,SETUP_TYPE=replication \
  --database valkey=8
```

`--parallel` writes each setup's stdout/stderr to its own log file. Successful
setups print a one-line summary and their agents' states as soon as they
finish; failed setups dump their buffered log immediately. Add `--verbose` to
echo the logs of successful setups as well. All setups are allowed to finish,
and the framework returns nonzero if any setup fails. On failure the log
directory is kept for inspection; on a fully successful run it is removed.
`--setup-retries N` reruns a failed setup up to N more times.

Each setup runs in its own process group, so interrupting the framework also
stops the docker commands it started. An interrupt dumps the buffered log of
every setup still running and keeps the log directory; under a `timeout`
wrapper that buffer is the only record of where a setup got stuck.

Setups that cannot run concurrently, two of the same database type or any two
of the MySQL family (PS/MySQL), fall back to sequential execution with a
warning, so every requested setup still runs. Three pairs cannot share a host
at all, and preflight refuses them: two PSMDB setups, EXTERNAL with VALKEY, and
PDPGSQL patroni with PGSQL replication. Provision those on separate machines.

`--database` values use this grammar:

```text
NAME[=VERSION][,OPTION=VALUE...]
```

Names and option keys are case-insensitive. Supported setup keys are:

- `PS`, `MYSQL`, `SSL_MYSQL`, `PXC`
- `PGSQL`, `PDPGSQL`, `SSL_PDPGSQL`
- `PSMDB`, `SSL_PSMDB`
- `HAPROXY`, `EXTERNAL`, `VALKEY`

Versions, options and their defaults are registered in
[`lib/config.sh`](lib/config.sh). `pmm-framework --list-databases` prints each
type's default and supported versions, without needing Docker. `VERSION`
`latest` means the type's default, in a spec and in a `<TYPE>_VERSION`
variable. `shards`/`sharding` are aliases for PSMDB, and `sentinel`/`sentinels`
for Valkey. A version or option not registered there is refused, so a typo
cannot quietly run a different setup.

Configuration precedence is:

1. Global `--client-version` flag (for `CLIENT_VERSION`)
2. Environment variable
3. Per-database option
4. Registered default

The `--client-version` flag comes first so an explicit override beats an
ambient `CLIENT_VERSION` in the environment (e.g. one exported by CI).
`CLIENT_VERSION` takes a channel (`3-dev-latest`, `pmm3-rc`, `pmm3-latest`), an
exact `3.x.y` release, or a tarball URL; `latest-tarball` is normalized to the
current PMM Client build-cache URL for the host architecture.

A value passed as `--pmm-server-password` stays in the process command line for
the whole run and is readable by other users on the host via `ps`. On shared
runners, export `ADMIN_PASSWORD` instead; it takes precedence over the flag and
is not exposed in the command line.

## Debug a failed setup

- `==> step` / `<== step (time)` lines show how far a setup got.
- `ERROR: Command failed: ...` names the docker command that failed;
  `Gave up on X after N attempt(s); last output: ...` is a wait that timed out.
- With `--parallel`, a failed setup prints its whole log between
  `FAILED (exit=N)` and `END`, and the log directory path is kept.
- `agent-status` lines list each exporter's state on the node.
- To reproduce, start a PMM Server locally and rerun the exact `pmm-framework`
  arguments from the CI log with `PREBAKED_PULL=always`, so the images match
  CI. Add `--verbose` for the full output.

## Changing the framework

[ARCHITECTURE.md](ARCHITECTURE.md) covers the code: the module map, the run
flow, how to add a version, a database type or a flag, and how to test a
change (`make check`).
