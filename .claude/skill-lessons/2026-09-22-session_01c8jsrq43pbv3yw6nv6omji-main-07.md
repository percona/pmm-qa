# .claude/hooks/lint-changed.sh — no group selects `codeceptjs-e2e` JavaScript, so a green Lint check over a `.js` diff linted nothing

- Added: 2026-09-22
- Applies to: target only
- Evidence: A two-file `.js` diff under `codeceptjs-e2e/` passed the repo's `Lint` check and `lint-changed.sh` exited 0 printing only `==> skip-until expiry`. The eslint group selects `\.ts$` and additionally requires the workspace's `package.json` to expose a `"lint"` script; `codeceptjs-e2e` exposes `lint:tests` and its sources are `.js`, so neither condition holds and no linter ever saw the files. Running `./node_modules/.bin/eslint --ext .js <files>` in that workspace worked and exited 0, so the config itself is usable — only the dispatch is missing.
- Proposed change: Extend the eslint group to select `.js` as well as `.ts`, and to fall back to the workspace's `lint:tests` script (or invoke `eslint --ext .js,.ts` directly) when no `"lint"` script exists, so `codeceptjs-e2e` diffs are actually gated; until then, a near-silent exit 0 from the dispatcher means "no gate covers this diff", not "clean".
