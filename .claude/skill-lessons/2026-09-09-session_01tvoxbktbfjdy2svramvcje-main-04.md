# .claude/skills/qa-code-review/SKILL.md — no reference covers `.github/scripts/**`, so a shell script there gets only the cross-cutting checks

- Added: 2026-09-09
- Applies to: target only
- Evidence: reviewing percona/pmm-qa#1396, which adds `.github/scripts/reset-runner-clients.sh`, the reviewer reported it "was held only to the cross-cutting checks" because `.github/scripts/` has no reference; the routing table at SKILL.md:27 maps `.github/workflows/**` to `references/ci-workflows.md` and has no row for the sibling scripts directory, whose existing occupants (`wait-for-gh-run.sh`, `wait-for-gh-run-completion.sh`) are CI glue with their own conventions — `#!/usr/bin/env bash`, `set -euo pipefail`, a header naming Usage and Environment only when the script takes arguments.
- Proposed change: add a `.github/scripts/**` row to the routing table pointing at a reference (extending `ci-workflows.md` or a new one) that states those conventions plus the checks a CI shell script needs — shellcheck clean, every external command time-bounded, an exit code that cannot fail the calling step by accident.
