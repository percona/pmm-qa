# PR Discovery, Health, and Diff Review

## Find PRs

```powershell
gh search prs "PMM-14915" --repo percona/pmm --json number,title,url
gh search prs "PMM-14915" --repo percona/grafana --json number,title,url
```

```powershell
gh pr view <n> --repo percona/pmm --json title,body,url,files,state,statusCheckRollup
gh pr diff <n> --repo percona/pmm
```

`gh pr diff` does not accept multiple `-- <path>` filters in one call (errors with "accepts at most 1 arg(s)"). Save the full diff to a scratch file and read the sections you need instead of trying to filter server-side:

```bash
gh pr diff <n> --repo percona/pmm > "<scratchpad>/pr<n>.diff"
```

## pmm-submodules PR

Read the FB link in the pmm PR body (e.g. `Percona-Lab/pmm-submodules/pull/4376`). **Submodules PR number ≠ pmm PR number.** If the body doesn't state it directly, search:

```powershell
gh search prs "PMM-14915" --repo Percona-Lab/pmm-submodules --json number,title,url,state
```

## Check PR health before trusting ticket status

A Jira status of "Ready for QA" does **not** mean the linked PR's checks are green. Always pull `statusCheckRollup` (from the `gh pr view` call above) and scan for any non-`SUCCESS` conclusion (`FAILURE`, `CANCELLED`, etc.) on required checks like `Merge Gatekeeper` or `codecov/project`.

- If checks are failing → still test, but call it out explicitly in the test-instructions summary (step 10) rather than silently assuming the PR is stable. The ticket assignee/reporter should know before merge.
- Don't confuse this with FB Tests (the `pmm-submodules` matrix, covered in `fb-tests.md`) — this is the PR's own CI on `percona/pmm` or `percona/grafana`.

## Scan for cross-repo dependencies

Read the PR body/description text (not just the diff) for links to PRs in **other** Percona repos — a common pattern is "(depends on `https://github.com/percona/<other-repo>/pull/<n>`)" when a change relies on an unreleased library version.

If found:

- Note whether that dependency PR is merged. If not, the feature under test may be incomplete or running against a dev/unreleased version of a shared package.
- If that other repo isn't one of the siblings in `repo-setup.md`'s table, its source isn't locally inspectable under this workflow — say so explicitly rather than silently treating the feature as fully verifiable from code.

## Review PR diffs — don't trust "How to test" blindly

Do this now, in the same pass as PR discovery/health above — before FB test triage or local-provisioning engine selection, which both depend on knowing the diff's real scope.

1. Read diffs in `percona/pmm` and/or `percona/grafana` in full — not just the file list.
2. Read the entire Jira ticket, including all comments, and compare every requested behavior, acceptance criterion, and implementation detail with the full PR diff. If any has no corresponding implementation in the diff, explicitly flag it as missing; do not assume it is covered or silently omit it from the test instructions.
3. Map changes to concrete UI/API/network steps.
4. Note post-provision steps (PMM Settings toggles, etc.).
5. **Check ticket QA notes for completeness, not just correctness.** The Jira "How to test" field (`customfield_10083`) may describe only part of the diff's actual scope (e.g. it names one UI area but the diff also touches an older/unrelated panel). Compare the QA notes' claimed scope against the full file list from `gh pr view --json files` — any changed file/area the QA notes don't mention is an extra test area to add, not to skip.
6. Flag any diff hunk that changes input validation/type (e.g. a numeric field becoming a text field) even if unrelated to the ticket's stated intent — these are easy-to-miss regression risks the PR description won't call out.

## Edge cases — add to the manual plan, don't just verify the happy path

Regression (did this break something *else*) is already covered by FB Tests / the automated suite — don't duplicate that here. This step is about the *new* behavior itself: does it hold up at its boundaries, not just under the one scenario the ticket describes.

For each piece of new/changed behavior identified above, walk through and note which apply:

- **Empty/no-data state** — the feature with zero rows, zero services, zero configured items.
- **Boundary values** — min/max, zero, negative, very large numbers, empty strings, max-length strings.
- **Error/failure paths** — invalid input, a dependent API/service down, a timeout — does the UI degrade gracefully or does it break silently?
- **Permission/role levels** — does the behavior differ for viewer vs. editor vs. admin, if roles apply here?
- **Cross-engine variance** — if the feature is DB-agnostic (dashboards, generic components), does it hold for each engine in scope, not just the first one tested?
- **Concurrent/repeat use** — re-running the action, multiple sessions, rapid repeat clicks, if plausible for this feature.

Not every category applies to every ticket — skip ones that are clearly irrelevant to the change, but say so isn't required; just don't list a step for it. Add whichever apply as explicit steps in the test instructions (step 10), not as an afterthought.

Cross-checking these findings against FB test failures happens next, once you reach `fb-tests.md` — this step only needs the diff and the ticket, not FB results.

## gh CLI quick reference

| Task | Command |
|------|---------|
| FB Tests (PR checks) | `gh pr checks <n> -R Percona-Lab/pmm-submodules` |
| View PR | `gh pr view <n> -R owner/repo --json title,body,url,files,state,statusCheckRollup` |
| PR diff | `gh pr diff <n> -R owner/repo` |
| Search by ticket | `gh search prs "PMM-XXXX" --repo percona/pmm` |
| PR comments | `gh api repos/OWNER/REPO/issues/<n>/comments` |
