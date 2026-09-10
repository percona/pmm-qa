# .claude/skills/qa-code-review/references/provisioning.md — an "no setup sets X" claim must cover the compose setups, not only the `docker run` playbooks

- Added: 2026-09-10
- Applies to: target only
- Evidence: A review argued a container-hostname branch was dead code because "No setup playbook passes `--hostname` to `docker run`", citing `qa-integration/pmm_qa/ps_pmm_setup.yml:33` and its siblings; the author answered that `qa-integration/pmm_psmdb-pbm_setup/docker-compose-rs.yaml` and `docker-compose-sharded.yaml` pin `rs101`…`rs203`, which makes that branch unsafe rather than dead, since those two setups land on different shards against one server (https://github.com/percona/pmm-qa/pull/1392#discussion_r3972583997). Confirmed in the checkout: those compose files set `hostname:`, and no playbook passes `--hostname`.
- Proposed change: Add a row to the provisioning table — before asserting a container attribute is never set anywhere, grep every provisioning form, `docker run` playbooks and `pmm_psmdb-pbm_setup/docker-compose-*.yaml` alike, because compose pins hostnames the `docker run` setups leave as the short container id.
