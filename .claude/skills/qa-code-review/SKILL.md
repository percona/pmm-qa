---
name: qa-code-review
description: Review an open pull request in percona/pmm-qa — Playwright and CodeceptJS tests, CLI tests, GitHub Actions workflows, provisioning. Use when asked to review a pmm-qa PR, check a QA diff before merge, or judge whether a test change is sound.
---

# QA code review

Reviews an **open PR in `percona/pmm-qa`**. Writes review threads and nothing else: never opens, edits, pushes to, approves or merges a PR.

## 1. Run the linters before reading anything

Never raise a style finding a linter owns. Run what the diff touches, from the repo root:

| Diff touches | Run |
|---|---|
| `e2e_tests/**/*.ts` | `cd e2e_tests && npm ci && npx eslint . && npx tsc --noEmit` |
| `cli/**/*.ts` | `cd cli && npm ci && npm run lint` |
| `codeceptjs-e2e/**/*.js` | `cd codeceptjs-e2e && npm ci && npx eslint tests/` |
| `.github/workflows/**` | `actionlint` |
| `*.sh` | `shellcheck -S error <files>` |
| `*.yml` `*.yaml` | `yamllint -d relaxed <files>` |
| `e2e_tests/tests/**`, `cli/tests/**`, `qa-integration/pmm_qa/scripts/database_options.py` | `python3 support_scripts/generate_readme.py --check` |

A finding that also reproduces on `main` is pre-existing: report it as 🔵 with that note, do not block the PR on it.

## 2. Read the reference that matches the diff

| Path in the diff | Reference |
|---|---|
| `e2e_tests/**` | [playwright-suite.md](references/playwright-suite.md) |
| `cli/**` | [cli-suite.md](references/cli-suite.md) |
| `codeceptjs-e2e/**` | [codeceptjs-legacy.md](references/codeceptjs-legacy.md) |
| `.github/workflows/**` | [ci-workflows.md](references/ci-workflows.md) |
| `qa-integration/**`, `package_tests/**`, `terraform/**` | [provisioning.md](references/provisioning.md) |

## 3. Checks that apply to every PR

1. **Scope.** The diff touches only what the PR claims. `package.json` / `package-lock.json` change only if a dependency actually changed. No reformatting of lines the PR did not otherwise need to touch — reformatting turns every later push into a new review.
2. **Body matches diff.** The description describes what the diff actually does, and links the CI run that proves it. A body describing work that is not in the diff is 🔴.
3. **CI on the head.** Red CI with review requested is 🔴 — the author checks the run before asking. A test that passed on one run and failed on another is flaky, not green.
4. **Reachability.** A new or retagged test is reachable from a workflow in the same PR. Prefer an existing tag and runner; inventing a tag, or widening a workflow's `--grep` to rescue a test that is missing its file's own tag, is 🔴.
5. **Test case ID.** Every test title carries its `PMM-Txxxx` (`PMM-Txxxx - description`, or `PMM-Txxxx + PMM-Tyyyy - description`). Create the ticket first — see the `zephyr` skill.
6. **Generated regions.** Content between `<!-- *-START -->` / `<!-- *-END -->` markers is produced by `support_scripts/generate_readme.py:191`. A hand edit there is 🔴 even when the text happens to be right.
7. **Over-engineering.** Hand-rolled machinery is a finding until proven necessary. Duplicated blocks, a helper or const file with one caller, two tests where one covers the regression, a new tag where an existing one fits — all 🟡 or worse.
8. **New `eslint-disable`.** The `--` reason must state a real invariant. `TODO` as the reason means the code is not ready.
9. **Bot findings.** CodeRabbit findings are claims to verify, not noise: an unanswered valid one is 🟡. Never restate a finding that already has a thread.
10. **Blocked PR.** Depends on unmerged work → draft, with the dependency linked in the body (`> [!WARNING] This is dependent on <url>` or a plain `Depends on <url>`).

## 4. Severity

| | Means |
|---|---|
| 🔴 **Blocker** | Merging makes CI lie, breaks another suite, or the change cannot do what it claims. |
| 🟡 **Should fix** | Real defect or convention break, not merge-stopping by itself. |
| 🔵 **Nit** | Preference, or pre-existing debt this PR only brushes against. |

## 5. Output

- One thread per finding, anchored at the exact `file:line`.
- Thread body: the claim in one sentence, then why it matters, then the concrete change. Lead with the emoji.
- One summary comment: counts per severity, plus any finding that has no line to anchor to.
- Say what you ran (section 1) and its result in the summary.

## 6. Never

- Never approve, merge, push, or edit the PR's files.
- Never post findings before section 1 has run.
- Never raise a formatting nit a linter owns.
- Never soften a rule to let a PR pass; say it is a Blocker and why.
