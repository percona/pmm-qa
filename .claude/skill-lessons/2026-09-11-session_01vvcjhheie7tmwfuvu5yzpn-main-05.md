# .claude/skills/qa-code-review/SKILL.md — a no-lint-gate claim must name the dispatcher's selector, not a changed-file filter

- Added: 2026-09-11
- Applies to: target only
- Evidence: a review summary reached the right verdict by the wrong mechanism — "`lint.yml` runs `npm run lint` only for workspaces with changed `.ts` files". `lint.yml:59` pipes every tracked file (`git ls-files -z`) into `.claude/hooks/lint-changed.sh`, which filters nothing by change; the actual gaps are the eslint group's `'\.ts$'` selector (`:43`) and the `grep -q '"lint"'` workspace gate (`:60`), which `codeceptjs-e2e` fails because it exposes only `lint:tests` — so no CI lint gate covers that suite in any language (https://github.com/percona/pmm-qa/pull/1414#issuecomment-5638484542). Recurrence of the 2026-09-09 entry on reading the dispatcher rather than the workflows.
- Proposed change: extend check 15 so a coverage claim names the dispatcher selector or workspace gate that excludes the files, and note that `codeceptjs-e2e` has no CI lint gate at all.
