# CLAUDE.md — a scratch copy of a config with relative requires belongs beside the original, not in the scratch directory

- Added: 2026-09-13
- Applies to: all skills
- Evidence: The House style rule says to copy a tooling config to the scratch directory and point the tool at it. `codeceptjs-e2e/pr.codecept.js` resolves `./codeceptConfigHelper` and `./tests/helper/hooks.js` relatively, so a scratch-directory copy cannot load; an untracked sibling in the same directory (`probe.codecept.js`, flipping `keepTraceForPassedTests` to true) worked and produced a passing run's own stall measurements without editing the tracked config.
- Proposed change: Qualify the House style rule: when the config resolves paths relatively, the patched copy goes beside the original under an untracked name and is passed with the tool's own config flag; only a location-independent config belongs in the scratch directory. Either way the tracked file stays untouched.
