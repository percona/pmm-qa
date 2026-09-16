# .claude/skills/ui-evidence/SKILL.md — PMM 3 renders the dashboard in an iframe, so top-frame DOM work finds nothing

- Added: 2026-09-16
- Applies to: target only
- Evidence: On a PMM HA dashboard, `PW_CLICK_TEXT='Namespace'` clicked PMM's own shell without opening the Grafana variable picker, and `page.evaluate(() => document.querySelectorAll(...))` returned zero elements for text plainly visible in the screenshot; `page.frames()` reported 2 frames and the same lookup inside the second frame found the picker immediately.
- Proposed change: In ui-evidence, state that the Grafana dashboard lives in an iframe — any interaction beyond `PW_CLICK_TEXT` must iterate `page.frames()` and offset clicks by `frameElement().boundingBox()` — and that `PW_CLICK_TEXT` on a variable's label does not open its combobox.
