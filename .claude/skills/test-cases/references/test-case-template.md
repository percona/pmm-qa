# Test-case template

Use this format for every proposed case.

## Rules

- Use a short, action-oriented title, numbered to match the summary table.
- Assign `High`, `Normal`, or `Low` priority from failure impact.
- Assign `Needs automation` or `Manual` on the same line as the priority.
- Name the primary defect the case catches and its traceable evidence.
- Write the step as the action a person performs, in product words; put the exact command, query, URL, or value in `Data`, empty when the step needs none.
- Omit the `Precondition` line when unnecessary; do not write `None` or `N/A`.
- Capture the identifier of any state the case will modify in its first step, and address that state by the captured identifier afterwards.
- Give the first step an assertion that the precondition actually holds.
- Write every wait as the event waited for, never as a duration; bound an absence assertion with an observable event as well.
- Assert the prohibited side effect next to the intended result, in its own row when it has its own failure cause.
- End with a `Cleanup` line naming what is restored; write it so a failed step cannot skip it.
- Use only `Step`, `Data` and `Expected` columns.
- Start every table cell with `- `; publishing strips it, so it never reaches Zephyr.
- Use short sentence fragments.
- Use one observable result per row.
- Keep the fewest useful rows.
- Merge navigation, input, and submission when they lead to one result.
- Separate different assertions, failure causes, asynchronous boundaries, or verification layers.

## Zephyr mapping

| Template | Zephyr field |
| --- | --- |
| Title | `name` |
| Priority | `priorityName` |
| Needs automation / Manual | `statusName` — `Needs Automation` / `Manual Only`; the automating test later flips it to `Automated` |
| Catches / Evidence | `objective` |
| Precondition | `precondition` |
| Step | step `description`, leading `- ` stripped |
| Data | step `testData`, leading `- ` stripped; unset when the cell is empty |
| Expected | step `expectedResult`, leading `- ` stripped |
| Cleanup | final step, no expected result; in automation it belongs in a fixture teardown, not a step |

## Template

```markdown
### <N>. <Short title>

Priority: <High | Normal | Low> · <Needs automation | Manual>

Catches: <Primary defect> — Evidence: <acceptance criterion, implementation branch, invariant, or historical mechanism>

Precondition: <Short optional setup>

| Step | Data | Expected |
| --- | --- | --- |
| - <Combined action, capturing the identifier of the state it will modify> | - <Exact command, query, or value> | - <Observable result confirming the precondition holds> |
| - <Action> | | - <Observable result> |
| - <Action> | - <Exact command, query, or value> | - <Prohibited side effect that must not occur> |

Cleanup: <What is restored, and where it runs so a failure cannot skip it>
```

## Example

Case-1 Adapted from automated case `PMM-T2197` in `e2e_tests/tests/navigation.test.ts`, linked to PMM-14544. When Zephyr is available, use its `get` operation to read the stored case before reusing or extending it.

```markdown
### 1. Non-admin user sees no admin-only menu items

Priority: Normal · Needs automation

Catches: Viewer role still sees Configuration or Export logs — Evidence: PMM-14544 RBAC menu acceptance criterion

Precondition: Logged in as admin.

| Step | Data | Expected |
| --- | --- | --- |
| - Create a non-admin user and capture its login. | - `POST /graph/api/admin/users` with role `Viewer` | - User is listed under Administration → Users with role Viewer. |
| - Sign out, sign in as the captured user, open the left menu. | | - Configuration is not in the menu. |
| - Open Help. | | - Export logs button is not visible. |

Cleanup: Delete the captured user, in teardown so a failed assertion still removes it.
```
