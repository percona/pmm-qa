# .claude/skills/linode-docker-provisioning/SKILL.md — exclude pmm-server when replaying a CI cleanup hook that wipes every container

- Added: 2026-09-09
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: Reproducing a nightly setup failure meant replaying the workflow's `on_retry_command` (`docker rm -f $(docker ps -a -q)`); on CI the PMM Server is remote (`pmm_server_address` input) but on the repro VM it is a local container, so the verbatim hook destroyed `pmm-server` and the `pmm-data` volume and the whole setup had to be rebuilt and re-run.
- Proposed change: In the skill, note that a CI step which acts on "every container on the runner" has a different blast radius on the repro VM, and scope such a replay to the client containers (`docker ps -q | grep -v $(docker inspect -f '{{.Id}}' pmm-server | cut -c1-12)`), stating the exclusion in the evidence.
