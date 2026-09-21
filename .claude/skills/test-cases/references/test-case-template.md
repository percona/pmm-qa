# Test-case template

Use this format for every proposed case.

## Rules

- Use a short, action-oriented title, numbered to match the summary table.
- Assign `High`, `Normal`, or `Low` priority from failure impact.
- Assign `Needs automation` or `Manual` on the same line as the priority.
- Name the primary defect the case catches and its traceable evidence. Implementation evidence carries a location, repository path plus function or line; a claim without one is not evidence.
- Write the step as the action a person performs, in product words, as if explaining it to a colleague who does not know the code: "as the viewer, ask for a snapshot through the data source", never `GET /graph/api/datasources/proxy/<id>/snapshot/create`. No URL, path, endpoint, header name, command, flag, or JSON appears in a Step or Expected cell; every one of them goes in `Data`, empty when the step needs none.
- Write the expected result as what the person sees or gets, in plain words first; the exact code or value follows in parentheses when the oracle needs it: "the request is refused (403) and no snapshot directory appears".
- Give the case a title a product manager would understand: what the user does and what must hold, not the mechanism.
- Before finishing, read the Step and Expected columns without the Data column. If a row cannot be followed that way, rewrite it.
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

Catches: <Primary defect> — Evidence: <acceptance criterion, invariant, or historical mechanism>; <repo/path:function or line for implementation evidence>

Precondition: <Short optional setup>

| Step | Data | Expected |
| --- | --- | --- |
| - <Combined action, capturing the identifier of the state it will modify> | - <Exact command, query, or value> | - <Observable result confirming the precondition holds> |
| - <Action> | | - <Observable result> |
| - <Action> | - <Exact command, query, or value> | - <Prohibited side effect that must not occur> |

Cleanup: <What is restored, and where it runs so a failure cannot skip it>
```

## Example

A real Zephyr case, in the register every case must match. Someone who has never tested PMM can follow it; nothing in Step or Expected needs the Data column to make sense.

```markdown
### 1. Filtered RTA queries can be paged through in the details view

Priority: Normal · Needs automation

Catches: The details view pages through all queries instead of the filtered ones, or the arrows enable at the wrong end — Evidence: RTA details filter acceptance criterion

Precondition: RTA is running for the rs101 MongoDB service.

| Step | Data | Expected |
| --- | --- | --- |
| - Run three long queries whose text contains the filter word, and one query with different text. Pause RTA polling and filter by the word. | - filter word `rta-details-filtered` | - Only the three matching queries are shown. |
| - Open details for the first filtered query. | | - The previous arrow is disabled and the details match the first query. |
| - Click next. | | - The second filtered query is shown. |
| - Click next. | | - The third filtered query is shown and the next arrow is disabled. |
| - Click previous. | | - The second filtered query is shown again. |

Cleanup: Stop RTA polling for the service, in teardown so a failed step still stops it.
```
