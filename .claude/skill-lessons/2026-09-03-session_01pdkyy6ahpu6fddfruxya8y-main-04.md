# .claude/skills/ui-evidence/SKILL.md — a hidden browser tab cannot be produced in this environment, so visibility-dependent behaviour is manual-only

- Added: 2026-09-03
- Applies to: target only
- Evidence: A feature branched on `document.visibilityState === 'hidden'`. Five routes were tried and all left the page `visible` with no `visibilitychange` event: two pages in one context plus `bringToFront()` headless; the same headed under `xvfb-run`; CDP `Emulation.setPageVisibilityOverride` (reported `'Emulation.setPageVisibilityOverride' wasn't found`); CDP `Page.setWebLifecycleState: frozen` (accepted, no effect); CDP `Browser.setWindowBounds: minimized` headed (accepted, no effect). There is no window manager under Xvfb, so Chromium never treats a page as occluded or minimized. An automated test of such a branch would silently exercise the visible path instead and pass without testing anything.
- Proposed change: Add a short "what these helpers cannot capture" note recording that no available route makes `document.visibilityState` report `hidden`, so behaviour gated on a backgrounded tab must be verified by a human in a real browser and declared as a gap rather than automated.
