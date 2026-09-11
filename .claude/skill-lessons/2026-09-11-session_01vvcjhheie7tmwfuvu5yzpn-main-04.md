# .claude/skills/qa-code-review/references/provisioning.md — a relative Ansible include under `<feature>/tasks/` resolves from `<feature>/`

- Added: 2026-09-11
- Applies to: target only
- Evidence: a bot review called `../tasks/configure_container_apt.yml` broken in three playbooks and asked for `../../tasks/`. The author refused with a CI task path showing `percona_server_for_mysql/tasks/prepare_install_ps.yml` resolving its long-standing `../tasks/find_first_empty_docker_port.yml` to `qa-integration/pmm_qa/tasks/…`, plus a live VM run where all four tasks executed (https://github.com/percona/pmm-qa/pull/1416#issuecomment-5639709250). The suggested path would have broken the includes; the Ansible and Docker section carries no rule on include resolution.
- Proposed change: add to the Ansible and Docker section that a relative include in a file under `pmm_qa/<feature>/tasks/` resolves from `pmm_qa/<feature>/`, so `../tasks/x.yml` correctly reaches `pmm_qa/tasks/x.yml` — cite a run log's `task path:` line before calling one broken.
