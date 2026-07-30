# Bash PMM Framework

This directory contains an isolated Bash implementation of
[`../pmm-framework.py`](../pmm-framework.py). It preserves the live command-line
interface and reuses the existing Ansible playbooks and setup scripts. The
Python implementation and CI workflows remain unchanged while both versions
are validated side by side.

> **Contributing or reading the code?** See
> [ARCHITECTURE.md](ARCHITECTURE.md) for the module map, diagrams of the run
> flow, how value resolution works, and step-by-step instructions for adding a
> database type, a CLI flag, or a backend.

## Requirements

- Bash 4.4 or newer (associative arrays, name references, `inherit_errexit`,
  and safe expansion of empty arrays under `set -u`)
- Docker with the Compose v2 plugin
- Ansible, including `ansible-playbook` and `ansible-galaxy`
- `curl`
- A running PMM Server container, or an explicit `--pmm-server-ip`

The framework installs `community.docker` with `ansible-galaxy` if the
collection is missing. On macOS, ensure Homebrew Bash precedes `/bin/bash` in
`PATH`; Apple's bundled Bash 3.2 is unsupported.

When the existing `pmm_framework` virtual environment is available, its Python
interpreter is automatically used for Ansible modules that require `requests`.
Set `ANSIBLE_PYTHON_INTERPRETER` explicitly to override this selection.

The `SSL_PSMDB` setup uses Compose's `!reset` override tag and therefore
requires Docker Compose 2.24 or newer. It generates temporary script and
override files instead of modifying the tracked source compose or shell files.

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
setups print only a one-line summary with the log path as soon as they finish;
failed setups dump their buffered log immediately, with no flag required. Add
`--verbose` to echo the logs of successful setups as well. All setups are
allowed to finish, and the framework returns nonzero if any setup fails. On
failure the log directory is kept for inspection; on a fully successful run it
is removed.

Each setup runs in its own process group, so interrupting the framework also
terminates the `ansible-playbook` processes it started.

Setups that cannot run concurrently — two of the same database type, or any two
of the MySQL family (PS/MySQL), which share `mysql_cluster_data` and host
ports — are detected during preflight. The run is not rejected: it falls back
to sequential execution with a warning, so every requested setup still runs.

To rerun the representative four-database setup and print its wall-clock time
to milliseconds:

```bash
qa-integration/pmm_qa/pmm-framework/run_parallel_timing.sh
```

`--database` values use this grammar:

```text
NAME[=VERSION][,OPTION=VALUE...]
```

Names and option keys are case-insensitive. Supported setup keys are:

- `PS`, `MYSQL`, `SSL_MYSQL`
- `PGSQL`, `PDPGSQL`, `SSL_PDPGSQL`
- `PSMDB`, `MLAUNCH_PSMDB`, `MLAUNCH_MODB`, `SSL_MLAUNCH`, `SSL_PSMDB`
- `PXC`, `HAPROXY`, `EXTERNAL`
- `DOCKERCLIENTS`, `BUCKET`, `VALKEY`

Aliases from the Python framework remain valid: `shards`/`sharding` for PSMDB
and `sentinel`/`sentinels` for Valkey.

Configuration precedence is:

1. Environment variable
2. Global `--client-version` (for `CLIENT_VERSION`)
3. Per-database option
4. Registered default

Each registration in `lib/config.sh` pins the version used when a spec omits
one with an explicit `DEFAULT_VERSION=` entry. It is not a user-settable
option, and the order of the version list carries no meaning. Registering
versions without a valid `DEFAULT_VERSION` fails immediately at startup.

A value passed as `--pmm-server-password` stays in the process command line for
the whole run and is readable by other users on the host via `ps`. On shared
runners, export `ADMIN_PASSWORD` instead; it takes precedence over the flag and
is not exposed in the command line.

`latest-tarball` is normalized to the current PMM Client build-cache URL.
PSMDB patch lookup uses `curl`; it does not require Python or `requests`.

## Side-by-side validation

From `qa-integration/pmm_qa`, run equivalent commands:

```bash
python3 pmm-framework.py \
  --pmm-server-ip 192.0.2.10 \
  --database ps=8.4,SETUP_TYPE=gr

./pmm-framework/pmm-framework \
  --pmm-server-ip 192.0.2.10 \
  --database ps=8.4,SETUP_TYPE=gr
```

Use `--verbose` on either command to compare the selected setup and resolved
environment. The Bash implementation passes a fresh environment map to each
playbook or script, so repeated `--database` values cannot leak setup-specific
variables into subsequent runs.

The old argparse-generated database subcommands and obsolete PMM 2 flags are
intentionally not implemented; current workflows use repeatable `--database`.

## Development

The entrypoint is intentionally thin. Shared behavior is under `lib/`, while
product-specific environment maps and dispatch live under `setups/`.
[ARCHITECTURE.md](ARCHITECTURE.md) walks through the call flow and the
extension points; every function also carries a header comment describing its
arguments, the globals it reads and writes, and how it reports failure.

Install development tools (`bats-core` and `shellcheck`), then run:

```bash
make check
```

Individual targets are available:

```bash
make syntax
make lint
make test
```

Contract tests stub Docker, curl, `ansible-galaxy`, and `ansible-playbook`.
They verify parsing, defaults and precedence, aliases, playbook/script
selection, representative environment maps, failure behavior, and
multi-database ordering without provisioning containers.
