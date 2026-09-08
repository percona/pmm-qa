# .claude/agents/investigator.md — check a UI control's enabled-state precondition before adopting it as a test fix

- Added: 2026-09-08
- Applies to: .claude/agents/investigator.md
- Evidence: A fix that replaced a test's unreliable deselect with a click on QAN's "Reset All" was adopted before checking the button's state; a probe then hit `locator.click: Timeout 20000ms exceeded` on `<button disabled ... data-testid="qan-filters-reset-all">`, showing the control is disabled whenever no filter is selected and that the fix was only valid because a selection is applied at that point in the scenario.
- Proposed change: In the fix step, require that when a fix routes through a different UI control, its enabled/visible precondition be confirmed against the live DOM and stated, since clicking a disabled control fails as a long actionability timeout rather than an obvious error.
