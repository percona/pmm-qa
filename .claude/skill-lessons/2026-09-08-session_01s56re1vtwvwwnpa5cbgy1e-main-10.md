# .claude/agents/investigator.md — "your fix misses path X" means grep for every sibling of the defect, not just X

- Added: 2026-09-08
- Applies to: .claude/agents/investigator.md
- Evidence: Verifying a reviewer's claim that `tasks/install_pmm_client.yml` fetched the same artifact bare found it true, and one grep for the same URL across `qa-integration/` turned up a third site the reviewer had not mentioned (`pmm3-client-setup-centos.sh`), so fixing only the named file would have left the same failure live.
- Proposed change: Add to the fix step that when a finding shows a fix missed one copy of a defect, grep the repo for every occurrence of the same pattern and enumerate the full set in the PR before fixing — completing the fix the PR already claims is not widening it.
