# Test-case template

Use this format for every proposed case.

## Rules

- Use a short, action-oriented title, numbered to match the summary table.
- Assign `High`, `Normal`, or `Low` priority from failure impact.
- Assign `Needs automation` or `Manual` on the same line as the priority.
- Name the primary defect the case catches and its traceable evidence.
- Put the exact command, query, or value in the step, not a description of it.
- Omit the `Precondition` line when unnecessary; do not write `None` or `N/A`.
- Capture the identifier of any state the case will modify in its first step, and address that state by the captured identifier afterwards.
- Give the first step an assertion that the precondition actually holds.
- Write every wait as the event waited for, never as a duration; bound an absence assertion with an observable event as well.
- Assert the prohibited side effect next to the intended result, in its own row when it has its own failure cause.
- End with a `Cleanup` line naming what is restored; write it so a failed step cannot skip it.
- Use only `Step` and `Expected` columns.
- Start every table cell with `- `.
- Use short sentence fragments.
- Put test data in the step.
- Use one observable result per row.
- Keep the fewest useful rows.
- Merge navigation, input, and submission when they lead to one result.
- Separate different assertions, failure causes, asynchronous boundaries, or verification layers.

## Zephyr mapping

| Template | Zephyr field |
| --- | --- |
| Title | `name` |
| Priority | `priorityName` |
| Needs automation / Manual | `status` — `Automated` once written, otherwise the case stays manual |
| Catches / Evidence | `objective` |
| Precondition | `precondition` |
| Step | `description` |
| Expected | `expectedResult` |
| Cleanup | final step row; in automation it belongs in a fixture teardown, not a step |

## Template

```markdown
### <N>. <Short title>

Priority: <High | Normal | Low> · <Needs automation | Manual>

Catches: <Primary defect> — Evidence: <acceptance criterion, implementation branch, invariant, or historical mechanism>

Precondition: <Short optional setup>

| Step | Expected |
| --- | --- |
| - <Combined action, capturing the identifier of the state it will modify> | - <Observable result confirming the precondition holds> |
| - <Action> | - <Observable result> |
| - <Action> | - <Prohibited side effect that must not occur> |

Cleanup: <What is restored, and where it runs so a failure cannot skip it>
```

## Example

Case-1 Adapted from automated case `PMM-T2168` in `e2e_tests/tests/inventory/inventory.test.ts`. When Zephyr is available, use its `get` operation to read the stored case before reusing or extending it.

```markdown
### 1. Refresh inventory data

Priority: Normal · Needs automation

Catches: Expanded row collapses during polling — Evidence: PMM-T2168 polling behavior

Precondition: One inventory item added by this case, its service ID captured.

| Step | Expected |
| --- | --- |
| - Open Inventory and expand the row for the captured service ID. | - The row is present and its details are visible. |
| - Wait for two consecutive `/v1/inventory/services` polls to complete. | - The second poll returns the captured service ID. |
| - Check the expanded row. | - Row details are still open, and no other row expanded. |

Cleanup: Remove the service added for this case, in teardown so a failed assertion still removes it.
```
