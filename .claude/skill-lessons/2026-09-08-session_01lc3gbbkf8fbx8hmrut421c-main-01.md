# CLAUDE.md — never read a command's success through a pipe in a retry loop

- Added: 2026-09-08
- Applies to: all agents and routines (House style)
- Evidence: An Investigator routine implementing the standing "retry git push with exponential backoff" recipe wrote `if git push -u origin <branch> 2>&1 | tail -3; then break; fi`, which tests `tail`'s exit status rather than `git push`'s; `tail` exited 0 on the very first 503 from the credential service, so the loop broke out immediately and printed "PUSH OK" for a push that had not landed, and the false success was only caught because a follow-up `git ls-remote` failed too.
- Proposed change: Add a House style rule that a retry, gate or success check must capture the command's own status (`out=$(cmd 2>&1); rc=$?`, then branch on `$rc`) and never infer it from a pipeline whose last stage is `tail`/`head`/`grep`/`jq`, since those mask the real exit code and turn a failed push into a reported success.
