# .claude/agents/investigator.md — dedup must search open PRs' changed files, not only their titles and bodies

- Added: 2026-09-22
- Applies to: target only
- Evidence: A full investigation of a failing `@docker-configuration` scenario — Linode VM, load-swept reproduction, fix, PR — was closed by the repo owner minutes after CI went green with "Fix is already in #1416". That open PR, titled "Stabilize all PMM test suite, from setup to tests.", already changed both files and added a `setSqlQuery` page-object method with the same select-all mechanism and the same `view-lines` assertion locator. Step 1's sweep read every open PR's title and body and found nothing, because the fix is named nowhere except in the diff.
- Proposed change: In step 1, after the marker sweep, check the failing spec's path against each open PR's changed-file list (`pull_request_read` `get_files`, or a code search for the spec path) and read the diff of any PR that touches it before starting work — a broad "stabilize the suite" PR is exactly the shape that fixes your test without naming it anywhere a title/body grep can see.
