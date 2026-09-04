# .claude/skills/linode-ha-provisioning/SKILL.md — a cleanup/reaper that lists account-wide must scope to a producer-specific tag and match tags exactly

- Added: 2026-09-04
- Applies to: all skills that delete cloud resources (teardown/reaper scripts)
- Evidence: A new teardown script defaulted to deleting Linode instances tagged `pmm-qa-ephemeral` via an account-wide `linode-cli linodes list`; that tag is also stamped by `terraform/linode-runner/main.tf` and `create-lke-pmm-ha.sh`, so a bare run would have deleted other live QA instances mid-test. It also matched with `grep -qw`, which treats `-` as a word boundary so `pmm-qa-perf` matched `pmm-qa-perf-run:<id>` too. A reviewer flagged it as data-loss before merge.
- Proposed change: A destructive cleanup that enumerates account-wide must key on a tag unique to the resources it created (never a shared marker like `pmm-qa-ephemeral`), match the tag as an exact array element (`--json | jq 'select(.tags | index($tag))'`, not a substring/word match), default to `--dry-run` or a narrow per-run tag, and never claim "deletes nothing else" when the key tag has other producers.
