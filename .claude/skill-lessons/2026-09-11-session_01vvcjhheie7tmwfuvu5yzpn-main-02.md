# .claude/skills/qa-code-review/SKILL.md — a "use the existing helper" finding must not swap a measured interaction for an unmeasured one

- Added: 2026-09-11
- Applies to: target only
- Evidence: on a flake fix, check 7 produced two findings in one thread — drop a three-attempt loop, and replace the hand-rolled clear with `adminPage.customClearField`. The author took the loop half and held the helper swap: `customClearField` replaces the focus step the PR actually measured (`I.click`) with `I.appendField(field, '')`, unmeasured on the one editor in the repo already known to under-clear on programmatic input (https://github.com/percona/pmm-qa/pull/1414#discussion_r3991913498).
- Proposed change: add to check 7 that where the hand-rolled block is a flake fix with a measured mechanism, an existing-helper substitution that changes that mechanism is 🔵 pending a run on the affected widget, not a 🟡 quick win — the duplication half of such a finding still stands on its own.
