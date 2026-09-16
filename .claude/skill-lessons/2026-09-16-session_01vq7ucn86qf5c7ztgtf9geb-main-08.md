# .claude/skills/qa-code-review/references/provisioning.md — a changed version default is not "silently shipped" when the same branch pins and exercises it

- Added: 2026-09-16
- Applies to: .claude/skills/qa-code-review/references/provisioning.md
- Evidence: A finding on a PXC default moved 8.0 to 8.4 was declined as deliberate — it aligns PXC with the PS/MYSQL defaults, and the branch's new `pxc-84`/`pxc-97` jobs pin both versions explicitly and were verified end-to-end; only the PR body's wording was actually wrong (https://github.com/percona/pmm-qa/pull/1439#discussion_r4024249663).
- Proposed change: Before calling a changed provisioning default unexercised, check the branch's own new CI jobs for an explicit pin of the new value; where they cover it, the remaining finding is the stale PR body under check 2 and nothing more.
