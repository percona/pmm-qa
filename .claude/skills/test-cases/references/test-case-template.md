# Test-case template

Use this format for every proposed case.

## Rules

- Use a short, action-oriented title, numbered to match the summary table.
- Assign `High`, `Normal`, or `Low` priority from failure impact.
- Assign `Needs automation`, `Automation candidate — infra gap`, or `Manual` on the same line as the priority, followed by its lane, its blocker, or its manual reason.
- Name the primary defect the case catches and its traceable evidence. Write the Catches part as one or two plain sentences a tester understands — what goes wrong for the user if the defect is back — and put function names, commits, and file references only after "— Evidence:". Implementation evidence carries a location, repository path plus function or line; a claim without one is not evidence.
- Write the step as the action a person performs, in product words, as if explaining it to a colleague who does not know the code: "as the viewer, ask for a snapshot through the data source", never `GET /graph/api/datasources/proxy/<id>/snapshot/create`. No URL, path, endpoint, header name, command, flag, or JSON appears in a Step or Expected cell; every one of them goes in `Data`, empty when the step needs none.
- Write the expected result as what the person sees or gets, in plain words first; the exact code or value follows in parentheses when the oracle needs it: "the request is refused (403) and no snapshot directory appears". Write a value in Step or Expected in plain quotes, never in backticks; `check_draft.py` rejects backticks there.
- Give the case a title a product manager would understand: what the user does and what must hold, not the mechanism.
- Before finishing, read the Step and Expected columns without the Data column, as a tester new to the feature would. If a row cannot be followed that way, or needs the Catches line to make sense, rewrite it.
- Omit the `Precondition` and `Cleanup` lines when unnecessary; do not write `None` or `N/A`.
- Capture the identifier of any state the case will modify in its first step, and address that state by the captured identifier afterwards.
- Give the first step an assertion that the precondition actually holds.
- Write every wait as the event waited for, never as a duration; bound an absence assertion with an observable event as well.
- Assert a prohibited side effect only when the failure model names one, next to the intended result, in its own row when it has its own failure cause.
- When the case changes persistent or shared state, end with a `Cleanup` line naming what is restored; write it so a failed step cannot skip it. A read-only case has none.
- Use only `Step`, `Data` and `Expected` columns.
- Start every table cell with `- `; publishing strips it, so it never reaches Zephyr.
- Use short sentence fragments.
- Give each row one action a person can do in one go, starting with who does it when the actor changes ("As the Viewer, …"). A step that needs "and then" across two results is two rows: opening a page and reloading it are separate rows.
- Use one observable result per row.
- Keep the fewest useful rows.
- Merge navigation, input, and submission when they lead to one result.
- Separate different assertions, failure causes, asynchronous boundaries, or verification layers.

## Zephyr mapping

| Template | Zephyr field |
| --- | --- |
| Title | `name` |
| Priority | `priorityName` |
| Needs automation / Automation candidate — infra gap / Manual | `statusName` — `Needs Automation` / `Needs Automation` with label `infra-gap` / `Manual Only`; `Draft` for any case whose expected result waits on an open Finding. The automating test later flips it to `Automated` |
| Catches / Evidence, then the lane, blocker, or manual reason | `objective` |
| Precondition | `precondition` |
| Step | step `description`, leading `- ` stripped |
| Data | step `testData`, leading `- ` stripped; unset when the cell is empty |
| Expected | step `expectedResult`, leading `- ` stripped |
| Cleanup, when present | final step, no expected result; in automation it belongs in a fixture teardown, not a step |

## Template

```markdown
### <N>. <Short title>

Priority: <High | Normal | Low> · <Needs automation — lane: <workflow · job> | Automation candidate — infra gap — blocked: <missing lane or helper> | Manual — <reason>>

Catches: <Primary defect> — Evidence: <acceptance criterion, invariant, or historical mechanism>; <repo/path:function or line for implementation evidence>

Precondition: <Short optional setup>

| Step | Data | Expected |
| --- | --- | --- |
| - <Combined action, capturing the identifier of the state it will modify> | - <Exact command, query, or value> | - <Observable result confirming the precondition holds> |
| - <Action> | | - <Observable result> |
| - <Action> | - <Exact command, query, or value> | - <Prohibited side effect the failure model names, when it names one> |

Cleanup: <When the case changes state: what is restored, and where it runs so a failure cannot skip it>
```

## Example

A real Zephyr case, in the register every case must match. Someone who has never tested PMM can follow it; nothing in Step or Expected needs the Data column to make sense.

```markdown
### 1. Filtered RTA queries can be paged through in the details view

Priority: Normal · Needs automation — lane: fb-e2e-suite.yml · rta

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
