# .claude/agents/investigator.md — verify a review-driven locator change against DOM fixtures once the repro VM is gone

- Added: 2026-09-02
- Applies to: target only
- Evidence: mandatory teardown destroys the repro VM at the end of the investigation, but a review bot then reported a real matching flaw in the very locator the fix changed; rebuilding both DOM shapes as static fixtures from markup captured earlier off the two live builds, and driving the *shipped* page-object locators against them, measured the collisions (2, 2 and 3 matches falling to 1) and confirmed every real name still resolved uniquely — without reprovisioning.
- Proposed change: note that a locator-only follow-up after teardown can be verified by replaying the captured markup as a fixture and asserting through the shipped locators, and that DOM markup worth capturing (the affected cell and action-column HTML for each build) should be saved while the VM is still up.
