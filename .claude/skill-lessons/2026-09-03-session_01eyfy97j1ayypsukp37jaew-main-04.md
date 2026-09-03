# .claude/skills/qa-code-review/references/playwright-suite.md — text spliced into a selector string is a locator finding, not a job for an escaping helper

- Added: 2026-09-03
- Applies to: .claude/skills/qa-code-review/references/playwright-suite.md
- Evidence: percona/pmm-qa#1220 answered a bot's "an apostrophe breaks `//div[contains(text(), '${title}')]`" finding by adding an XPath-literal `concat()` helper file, although every interpolated value was a test-file constant and `getByText`/`getByTestId` take the value as data and return the innermost matching element.
- Proposed change: Under Locators, add that caller text interpolated into an XPath or CSS string is 🟡 with the fix being `getByText`/`getByTestId`/`filter({ hasText })` (Playwright quotes the value, and `getByText` returns the innermost element so the XPath's element-type scoping is not lost), and that a new quoting or escaping helper for selectors is itself the finding.
