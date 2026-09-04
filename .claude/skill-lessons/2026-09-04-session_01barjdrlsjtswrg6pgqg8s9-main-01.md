# .claude/agents/investigator.md — a timing-shaped failure needs a loaded repro before "didn't reproduce"

- Added: 2026-09-04
- Applies to: target only
- Evidence: A scheduled `E2E tests Matrix` failure (`ElementNotFound` on a click one step after a UI state change) passed 3/3 on an idle 6-vCPU Linode VM, and failed 2/3 byte-identically to CI once 12 busy-loop spinners saturated the same box; the step 3 tree's "didn't reproduce at all → likely an infra flake" branch would have closed it as a flake off the idle runs alone.
- Proposed change: In step 3's "Didn't reproduce at all" branch, require re-running a timing-shaped failure (an element/actionability error, a wait timeout, an ordering-dependent assertion) under CPU oversubscription on the same VM — e.g. `for n in $(seq 12); do (while :; do :; done) & done`, killed afterwards — and comparing idle vs loaded pass rates before calling it unreproducible, since the throwaway VM is far less contended than a GitHub runner.
