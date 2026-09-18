# CLAUDE.md (House style) — Do not extract a single-use helper while growing inline code

- Added: 2026-09-18
- Applies to: all skills and agents that edit code
- Evidence: A fix widened an inline log dump in a catch block from one container to three; I hoisted it into a module-level `async function grabReplicaSetLogs(I)` with exactly one caller. The user asked "Pra que criar esse metodo se antes estava inlined?" and the block was inlined back unchanged.
- Proposed change: Add a House style bullet — when a change only makes existing inline code do more, keep it inline; introduce a named helper only when a second caller exists or the surrounding file already factors that shape out.
