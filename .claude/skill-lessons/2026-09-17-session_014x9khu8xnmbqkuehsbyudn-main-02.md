# .claude/agents/investigator.md — sweep load against the failing step alone, not the whole setup, once the first repro has stood the environment up

- Added: 2026-09-17
- Applies to: .claude/agents/investigator.md
- Evidence: The failing bounded wait sat inside a `pmm-framework` setup costing ~5 minutes per run; after one full repro left the containers up, re-running only the failing start-and-wait pair produced 15 trials across 5 load levels in about 5 minutes, where per-level full setups would have bought 1 trial each.
- Proposed change: Extend the load-sweep recipe to say that once the full reproduction has provisioned the environment, the sweep re-runs the failing step in isolation against the live containers rather than repeating the whole setup per load level.
