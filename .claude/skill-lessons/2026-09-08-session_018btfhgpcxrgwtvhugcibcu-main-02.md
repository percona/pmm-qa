# AGENTS.md — a clean `shellcheck -S warning` does not prove a `set -euo pipefail` error path runs

- Added: 2026-09-08
- Applies to: AGENTS.md
- Evidence: A trap added to `pmm-framework`'s parallel runner read `${pids[index]}` on a subscript the startup loop had not reached; `make syntax`, `shellcheck -x -S warning` and 57/57 bats all passed, but bash 5.2 aborts that shape with `pids[index]: unbound variable`, killing the trap before its `wait`, `rm -rf` and `exit 130` — the reviewer caught it, and a five-line probe script reproduced it in one run.
- Proposed change: In the linting section that records `*.sh` is held to `shellcheck -S warning`, note that the linters do not model `set -u`/`set -e` runtime aborts — an indexed-array read on a possibly-unset subscript needs the `:-` form, and a new error/cleanup path must be executed (a throwaway probe script is enough) rather than reasoned about.
