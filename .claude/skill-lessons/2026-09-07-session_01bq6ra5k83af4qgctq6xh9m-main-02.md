# .claude/skills/verification-depth/SKILL.md — read a sweep's hits before reporting its count; a name-keyed lookup must be prototype-safe and fail loudly

- Added: 2026-09-07
- Applies to: all skills and agents reporting counts from a self-written search or analysis script
- Evidence: An AST sweep keyed its method table with `name in TABLE`, which is true for `toString`/`valueOf` on any object literal, so all 15 reported "hits" were ordinary `.toString(...)` calls; the guard `args.length <= TABLE[name]` then compared a number against a function, yielding NaN and passing them through instead of erroring. Reading the hit list exposed it immediately; the count alone looked plausible.
- Proposed change: Before citing a sweep's count, inspect its actual matches rather than the total, and in a name-keyed lookup use `Object.hasOwn`/`Map`/`Object.create(null)` and make a missing or non-numeric table entry throw instead of silently falling through — the false-positive counterpart to the positive-control entry captured alongside this one.
