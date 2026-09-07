# .claude/integrations/slack/relay/relay.js — a periodic reaper must log a heartbeat every tick, not only when it acts

- Added: 2026-09-07
- Applies to: relay.js reapLke (and any scheduled sweep/cron that runs unattended)
- Evidence: The LKE reaper (`setInterval(reapLke, 15min)`) logs `checked N ephemeral cluster(s)` only when `checked>0`, and its orphan sweep logs only on error. After the one watched cluster was deleted and a transient Linode 502 outage cleared, every healthy tick found 0 clusters and swept cleanly — logging nothing for hours. The operator reasonably concluded the cleanup had died; ground truth (0 orphans, deleted volumes 404) proved it was running fine. A healthy-idle reaper was indistinguishable from a dead one in the logs.
- Proposed change: A long-running scheduled sweep should emit a one-line heartbeat on every successful tick (e.g. `reaper: tick ok (checked 0, reaped 0, orphan sweep ok)`), so liveness is observable when idle. Never gate the only per-tick log line behind "found something to do".
