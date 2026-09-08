# .claude/agents/investigator.md — An availability probe needs a known-good control value

- Added: 2026-09-08
- Applies to: target only
- Evidence: Probing a guessed artifact-URL shape returned 404 for the version under investigation and equally for three versions known to exist, so the result proved nothing; the correct URL shape was already present in the pipeline source being read.
- Proposed change: In the external-fetch paragraph, require every availability probe to include at least one value known to exist as a control, and to take the URL shape from the code under investigation rather than constructing one.
