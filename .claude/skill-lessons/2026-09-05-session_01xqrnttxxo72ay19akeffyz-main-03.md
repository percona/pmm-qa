# .claude/agents/investigator.md — a reproducible failure mode is not evidence it ever happened; confirm the incident before widening a fix

- Added: 2026-09-05
- Applies to: target only
- Evidence: A CI fix PR was widened with a guard justified by "~30 jobs reported green while running zero tests for a day". The silent-pass mechanism was reproduced locally (`run-workers` exits 0 printing `OK | 0 passed` when every worker dies), but when the user asked "voce tem caso concreto ai de algo que falhava e nao sabiamos", checking the post-bump scheduled runs on main showed every sampled job skipped at `Check if launchable subset is empty` — CodeceptJS was never invoked, so no run had ever swallowed the crash. The guard was removed.
- Proposed change: When a diagnosis proposes work beyond the failure being fixed on the grounds that something else fails silently, require a named real run exhibiting it (run id and the log line), not a local reproduction of the mechanism; without one, report the risk and leave it out of the fix.
