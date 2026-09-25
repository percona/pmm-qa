# Porting a database type to a prebaked image

Replace a type's Ansible playbook with a prebaked image plus plain `docker`
commands (`lib/images.sh`, `lib/prebaked.sh`). Port one type at a time, and do
not start the next until every CI spec for the current one has passed a real
run. PS, MySQL, SSL MySQL, PXC, PSMDB, SSL PSMDB, HAProxy, External, Valkey, PDPGSQL, SSL PDPGSQL and PGSQL are done;
copy them.

## 1. Measure before you change anything

- Time the old path from a clean copy of `HEAD`, never from a working tree you
  have already edited:
  `git archive HEAD qa-integration | tar -x -C <scratch>`.
- Time `provisioning/` (TypeScript) as the target to beat.
- Use one PMM Server for every run and remove the type's containers between
  runs.
- Use the `CLIENT_VERSION` CI actually passes. Grep `.github/workflows` for it;
  today that is `latest-tarball`. Package channels mostly measure mirror speed.
- Never build an image while a timed run is going.
- Record every number in `pmm-framework/BENCHMARK.md`.

## 2. Parity checklist

The contract is the **end state the playbook produced**. Read the playbook and
the scripts it calls, not `provisioning/`: the TypeScript engines use different
names and layouts in places (PXC's container layout, MySQL GR's
replication-set). Pin down:

- **Containers:** exact names, including dots versus underscores; how many
  containers and what runs in each; the network; the published host ports.
  When the playbook searched for a free port (`find_first_empty_docker_port.yml`),
  search too: CI puts two topologies of one type on one host.
- **Database users:** users, passwords and the auth plugin for each version.
- **Server settings** the playbook's `my.cnf` or SQL sets, such as
  `innodb_monitor_enable` and native password auth.
- **The default `docker exec` user.** The playbooks' containers ran as root,
  and tests `docker exec` without `--user` to read pmm-agent's root-owned
  files. Start the container with `--user root` and keep the database itself on
  its own user (`--user=mysql` for mysqld).
- **Host mounts** tests reach from outside the container, e.g. MySQL's
  `/tmp/mysql-sockets/N/mysql.sock`, which `cli/tests/mysql.spec.ts` uses with
  the runner's own `pmm-admin`.
- **Registration:** every `pmm-admin add`. That means the service name and its
  random-suffix pattern, `--environment`, `--cluster`, `--replication-set`, the
  host/port form, and the credentials.
- **Workload:** which workload, run from where, for how long, and whether it
  keeps running after setup.
- **Options:** every option the type registers in `lib/config.sh`, every
  env-var override, and every `--database` string for the type in
  `.github/workflows`. An option the image cannot honour must `die`, never be
  silently ignored.
- **What tests depend on:** grep `e2e_tests`, `cli/tests` and
  `codeceptjs-e2e/tests` for the container and service names. When a layout
  change would break tests, ask the user before choosing.
- **Node names:** no dots. Dashboards compare `node_name` with `=` against a
  regex-escaped multi-value variable, so `pxc_proxysql_pmm_8.4` never matches.
- **Every node's own settings:** clear what the playbook cleared on all nodes,
  not just the primary (GR secondaries stay `super_read_only`).

## 3. The image

- Add `build_<engine>_image VERSION` to `lib/images.sh`. `ensure_image`
  already handles "local copy, else pull from `PREBAKED_REGISTRY`, else build".
- Reuse `provisioning/images/engines/<engine>/Dockerfile` when its layout
  matches the playbook's. Otherwise add `pmm-framework/images/<engine>/`.
- When the old path is a compose stack, keep its compose files: tag the
  prebaked image with the name compose builds (`replica_member/local` for
  PSMDB) and never call `build`. Names, networks, ports and volumes then match
  for free.
- Keep systemd in the image when tests `systemctl` or `service` inside the
  container. It needs `--privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw`.
- Bake everything slow into the image: packages, sysbench, and pre-initialised
  data directories and users. Run time should only start things.
- Add the image to `.github/workflows/build-prebaked-images.yml`: the matrix and
  its "start it and check it works" step.
- Add any script inside the image to `BASH_SOURCES` in the Makefile.
- Base images differ: check each version's image for `microdnf`, `yum`,
  `percona-release`, `mysqladmin` and its OS release before using them.
  `microdnf` cannot install a local `.rpm` file, and `rpm -Uvh` skips its
  dependencies: use `yum` where it exists, `rpm -Uvh` only on microdnf-only
  images. EL8's curl
  has no `--retry-all-errors`.
- Install PMM Client at run time, not in the image, so one image serves every
  `CLIENT_VERSION`. On a Debian-family image `install_pmm_client` takes the
  package from `scripts/fetch-pmm-client-deb.sh`, which waits out
  repo.percona.com's index/pool publishing race.
- Use `COPY --chmod=0755`. A Windows checkout does not keep the executable
  bit.

## 4. The setup function

- Build it from the `lib/prebaked.sh` helpers: `step`, `must`,
  `retry`/`retry_on`, `each_node`, `install_pmm_client`, `setup_pmm_agent`,
  `wait_pmm_agent` and `wait_exporter`.
- **Every command must die on failure.** The sequential path runs the setup
  under `||`, so `set -e` is off and a failing bare command is skipped, with
  the setup still exiting 0.
- **Never use `[[ cond ]] && cmd` as a statement.** On the parallel path,
  errexit is on, and a false condition kills the setup. Use `if`.
- `pmm-agent setup` takes `[<node-address>] [<node-type>] [<node-name>]`; the
  first positional is the address, not the name.
- Give each container its own `/etc/machine-id` before `pmm-agent setup`;
  every container of one image otherwise reports the same machine_id.
- Replace fixed sleeps with probes for the state the next step needs.
- Time every step once. A wait the playbook hid can dominate:
  `pg_basebackup` sat out a spread checkpoint for 100 s until given
  `--checkpoint=fast`.
- Probe through shell functions, never `sh -c "... docker ..."`: a child
  shell cannot see the test's stubbed `docker`.
- Run `pmm-agent setup` one node at a time. Install, start and exporter waits
  can run in parallel with `each_node`.
- Retry `pmm-admin add` on `pmm-agent is not connected|context deadline
  exceeded`.
- Run the workload detached. If the playbook left load running, keep it
  running.
- Add the type to `setup_uses_ansible` in `lib/execution.sh`, and delete its
  `run_playbook` env map.
- Leave the playbook itself in place until every type is ported.

## 5. Tests

- Replace the type's playbook-capture tests in `tests/dispatch.bats` with
  `stub_prebaked_docker` tests. Assert the exact `docker run` and
  `pmm-admin add` lines, plus one rejection of an unsupported option.
- If `tests/integration.bats` used the type as its sample, move the sample to a
  type that still runs a playbook, and tell the user why.
- For every bug fix, revert the fix and confirm its test fails. Then run
  `make check`.

## 6. Verify for real

- Run every CI spec for the type once in WSL against a real PMM Server, plus
  one run with a package `CLIENT_VERSION`. Use each job's own client: the
  GSSAPI jobs pass `pmm-client-dynamic-ol<N>-latest.tar.gz`, and the plain
  tarball cannot authenticate with Kerberos. For each run, check:
  - the database state: nodes synced, or replication running;
  - the labels, read from `/v1/management/services` (`pmm-admin list` does not
    print them);
  - every exporter Running;
  - the workload's exit status.
- Before believing a pass, assert the check saw real input. An extraction that
  came back empty makes `bash -c ""` exit 0.
- Run the tests that depend on the type (step 2) against the new setup, with
  the framework flags CI uses. `runner-integration-cli-tests.yml` passes
  `--parallel --client-debug`, and the connection-timeout CLI tests read DSNs
  that pmm-agent only logs at debug level.
- Specs that call `sudo pmm-admin` on the host (`mysql.spec.ts`) only run on a
  CI runner, which installs a host client. Verify those in CI, not in WSL.
- Write the pmm-agent log where the playbook's client setup did, because tests
  read it: `/pmm-agent.log` for PXC, `/var/log/pmm-agent.log` for the
  `install_pmm_client.yml` types. This is `setup_pmm_agent`'s third argument.
- Fill in `BENCHMARK.md`.
- Leave everything uncommitted for review.
