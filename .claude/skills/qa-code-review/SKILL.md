---
name: qa-code-review
description: Review an open pull request in percona/pmm-qa — Playwright and CodeceptJS tests, CLI tests, GitHub Actions workflows, provisioning. Use when asked to review a pmm-qa PR, check a QA diff before merge, or judge whether a test change is sound.
---

# QA code review

Reviews an **open PR in `percona/pmm-qa`**. Its only output is review threads, plus a summary comment when one is warranted (section 5); it never opens, edits, pushes to, approves or merges a PR.

## 1. Read the checks, never run the PR's tooling

The reviewer runs nothing from the branch under review. `npm ci` executes the PR's own `prepare`/`postinstall`, and `eslint`/`tsc` load config files the PR controls — a review must not execute code it has not read yet. Lint and type checking belong to CI, which already ran them on this exact SHA in a controlled environment.

- Read the check runs for the PR's head SHA. A failing lint, type or test check is 🔴 under check 3 below: name the check and quote its output, do not re-derive it.
- No lint or type check covers what the diff touches → say so plainly in the summary, review the rest statically, and never substitute your own run for a missing gate.
- Never raise a style finding a linter owns. Where no linter owns it and none exists yet, it is 🔵 with that note.

A finding that is also present on `main` is pre-existing: 🔵 with that note, and it does not block the PR.

## 2. Read the reference that matches the diff

| Path in the diff | Reference |
|---|---|
| `e2e_tests/**` | [playwright-suite.md](references/playwright-suite.md) |
| `cli/**` | [cli-suite.md](references/cli-suite.md) |
| `codeceptjs-e2e/**` | [codeceptjs-legacy.md](references/codeceptjs-legacy.md) |
| `.github/workflows/**` | [ci-workflows.md](references/ci-workflows.md) |
| `qa-integration/**`, `package_tests/**`, `terraform/**` | [provisioning.md](references/provisioning.md) |
| `.claude/**`, `docs/**`, anything else | no reference yet — apply section 3 only |

A path with no reference gets section 3 and nothing more. Say that in the summary, so a gap in coverage never reads as a clean review.

## 3. Checks that apply to every PR

1. **Scope.** The diff touches only what the PR claims. `package.json` / `package-lock.json` change only if a dependency actually changed. No reformatting of lines the PR did not otherwise need to touch — reformatting turns every later push into a new review.
2. **Body matches diff.** The description describes what the diff actually does, and links the CI run that proves it. A body describing work that is not in the diff is 🔴.
3. **CI on the head.** Red CI with review requested is 🔴 — the author checks the run before asking. A test that passed on one run and failed on another is flaky, not green.
4. **Reachability.** A new or retagged test is reachable from a workflow in the same PR. Prefer an existing tag and runner; inventing a tag, or widening a workflow's `--grep` to rescue a test that is missing its file's own tag, is 🔴.
5. **Test case ID.** Every test title carries its `PMM-Txxxx` (`PMM-Txxxx - description`, or `PMM-Txxxx + PMM-Tyyyy - description`). Create the ticket first — see the `zephyr` skill.
6. **Generated regions.** Content between `<!-- *-START -->` / `<!-- *-END -->` markers is produced by `support_scripts/generate_readme.py:191`. A hand edit there is 🔴 even when the text happens to be right.
7. **Over-engineering.** Hand-rolled machinery is a finding until proven necessary. Duplicated blocks, a helper or const file with one caller, two tests where one covers the regression, a new tag where an existing one fits — all 🟡 or worse.
8. **New `eslint-disable`.** The `--` reason must state a real invariant. `TODO` as the reason means the code is not ready.
9. **Bot findings.** CodeRabbit findings are claims to verify, not noise: an unanswered valid one is 🟡. Never restate a finding that already has a thread. Read the PR's existing threads before writing anything and sweep every bot — CodeRabbit, Copilot, any other — for a finding the author never answered or resolved. Each one that is still open and still valid gets a thread asking for it to be answered and resolved; each one that is open but wrong gets a thread saying so, so the author can close it with a reason instead of leaving it hanging. A finding that already has a thread gets a **reply inside that thread**, never a parallel one. A finding with no file line — a PR-level bot verdict, a problem with the body or the scope — goes in the summary comment.
10. **Blocked PR.** Depends on unmerged work → draft, with the dependency linked in the body (`> [!WARNING] This is dependent on <url>` or a plain `Depends on <url>`).
11. **A method with one caller does not need to exist.** Called exactly once → inline it at the call site and delete it. Applies to page-object methods, helpers, API-class methods and const files alike. Reuse that is only planned is not reuse. 🟡
12. **No methods in a test file.** A test file holds tests. Behaviour belongs in a page object or a helper, whichever is more coherent for it — never declared next to the tests. This does not conflict with 11: 11 says do not create the abstraction when there is one caller, 12 says where it lives once it has earned existing. 🟡
13. **`private` is a smell.** In practice a private method exists to carve out one extra step that a single method with an internal branch would have covered. A new `private` needs a stated reason; without one, ask for it to be folded into its caller. Dropping an existing `private` is a move in the right direction, not a finding. 🟡
14. **Code comments get reduced, not reworded.** Every comment in the diff justifies itself or goes. Delete a comment that restates the code, narrates what a step is *not* doing, or banners a section. What survives: a non-obvious invariant, a workaround with its Jira link, a contract a caller cannot infer — one line each. 🟡

## 4. Severity

| | Means |
|---|---|
| 🔴 **Blocker** | Merging makes CI lie, breaks another suite, or the change cannot do what it claims. Also: any secret, credential or token exposed; an authorization or authentication check weakened; data loss; or a shared environment left unusable. |
| 🟡 **Should fix** | Real defect or convention break, not merge-stopping by itself. |
| 🔵 **Nit** | Preference, or pre-existing debt this PR only brushes against. |

## 5. Output

- One thread per finding, anchored at the exact `file:line`.
- Thread body: the claim in one sentence, then why it matters, then the concrete change. Lead with the emoji.
- Post each thread with `confirmed: true` where the tool takes it. Without it the comment is buffered and classified once the session ends, and a real finding can be dropped as a probe.
- No summary comment when the threads already say everything. The threads are the review; a comment restating them is noise.
- Nothing found at all: the whole summary is `LGTM!` — as a comment, never an approval. The one thing that goes with it is a gap section 1 or 2 left: no gate covers the diff, no reference covers a path. Clean checks that do cover the diff are worth no words.
- Nothing of your own, but open threads you agree with: one sentence in each of those threads, and no summary comment at all.
- Otherwise post one only for what has no line to anchor to: a finding about the body or the scope, a bot verdict with no file, a gate that misses the diff. Five lines at most, one of them the counts per severity. Never a walkthrough, a file table, or a restatement of a thread.
- Use `gh pr comment --edit-last --create-if-none`, so a later run replaces the summary instead of adding another. Where no summary is warranted and an earlier run left one, edit that comment down to a single line saying nothing is outstanding — an edit, not a new comment. Touch no comment but your own.

## 6. Never

- Never approve, merge, push, or edit the PR's files.
- Never post findings before section 1 has run.
- Never raise a formatting nit a linter owns.
- Never soften a rule to let a PR pass; say it is a Blocker and why.
