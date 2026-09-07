# .claude/agents/test-runner.md — a UI-only product fix can be tested without an FB image by swapping the built bundle

- Added: 2026-09-07
- Applies to: target only
- Evidence: with no usable FB image for a `ui/apps/pmm`-only PR, building the PR head on the box (`make -C ui release`) and copying `ui/apps/pmm/dist` into the server container's `/usr/share/pmm-ui` gave a clean before/after on one host with the server binary held constant; step 3 only covers pmm-qa branches via `PMM_QA_REF`.
- Proposed change: in step 3, add that a product change confined to `ui/apps/pmm` may be tested by building that workspace from the PR head and replacing `/usr/share/pmm-ui` in a current `main` server image, and that the swap is lost by a container recreate.
