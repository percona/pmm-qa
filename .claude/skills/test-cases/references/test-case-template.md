# Test-case template

Use this format for every proposed case.

## Rules

- Use a short, action-oriented title.
- Assign `High`, `Normal`, or `Low` priority from failure impact.
- Name the primary defect the case catches and its traceable evidence.
- Omit the `Precondition` line when unnecessary; do not write `None` or `N/A`.
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
| Catches / Evidence | `objective` |
| Precondition | `precondition` |
| Step | `description` |
| Expected | `expectedResult` |

## Template

```markdown
### <Short title>

Priority: <High | Normal | Low>

Catches: <Primary defect> — Evidence: <acceptance criterion, implementation branch, invariant, or historical mechanism>

Precondition: <Short optional setup>

| Step | Expected |
| --- | --- |
| - <Combined action> | - <Observable result> |
| - <Action> | - <Observable result> |
```

## Example

Case-1 Adapted from automated case `PMM-T2168` in `e2e_tests/tests/inventory/inventory.test.ts`. When Zephyr is available, use its `get` operation to read the stored case before reusing or extending it.

```markdown
### Refresh inventory data

Priority: Normal

Catches: Expanded row collapses during polling — Evidence: PMM-T2168 polling behavior

Precondition: One inventory item exists.

| Step | Expected |
| --- | --- |
| - Open Inventory and expand the first row. | - Row details are visible. |
| - Observe API calls for 10 seconds. | - Calls repeat every five seconds. |
| - Check the expanded row. | - Row details remain open. |
```
