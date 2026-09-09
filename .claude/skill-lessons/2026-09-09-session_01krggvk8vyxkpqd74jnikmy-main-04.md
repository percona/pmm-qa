# .claude/agents/investigator.md — dedup at investigation start goes stale when one CI burst fires the routine many times in parallel

- Added: 2026-09-09
- Applies to: target only
- Evidence: Nine nightly runs dispatched between 17:11 and 18:00 each fired this routine separately, and six sessions independently diagnosed the same `on_retry_command` leak and opened a PR for it: pmm-qa #1392 (19:37), #1393 (19:39), #1394 (19:42), #1396 (19:53), #1397 (20:10), #1398 (20:11). Step 1's PR sweep ran at ~19:20 and was genuinely clean; #1392 appeared 17 minutes later and the PR was opened at 19:42 with no re-check. Six Linode VMs and six ~37-job CI matrices were spent on one fix, and the resulting Actions contention left runs cancelled rather than green.
- Proposed change: In step 5, require re-running step 1's open-PR sweep immediately before `create_pull_request` and, if a PR for the same failure now exists, commenting on it with the extra evidence instead of opening another; note in step 1 that a burst of sibling runs fires this routine once per run, so a clean sweep is only clean as of its timestamp.
