# Zephyr test cases

Use the `relay` skill's Zephyr reference for payloads and transport. This file owns when and why PMM test cases are created or changed.

## Keys and titles

Every automated test carries its real Zephyr key. Never invent one.

| Use | Format |
| --- | --- |
| One case | `PMM-T2087 - Verify description @tag` |
| Several cases | `PMM-T948 + PMM-T947 - Verify A, Verify B @tag` |
| Zephyr `name` | `Verify description` — no key or tag |

The reporter splits on ` - ` and then ` + `, so preserve those separators exactly.

## Standalone automation workflow

When writing a genuinely new automated test, create a case directly; do not search thousands of cases first.

1. Read the relay Zephyr reference and call `folders`.
2. Call `create` with description-only `name`, `statusName: "Automated"`, the feature folder, and `Version of the Product`.
3. Put the returned `PMM-Txxxx` in the test title.
4. Confirm whether the suite reports executions before claiming the run will appear in a cycle.

When automating an existing manual case, reuse its supplied key and call `set-status` with `Automated`. Use `search` only for an explicit lookup or coverage audit, not as a gate before a known-new automation case.

Read a known case with `get`, not `search`; use its resolved names, path, steps, and Jira keys. Never infer a status name from an id.

## Status meaning

| Status | Meaning |
| --- | --- |
| `Needs Automation` | Reviewed case waiting for automation |
| `Automated` | Covered by a repository test |
| `Manual Only` | Reviewed and intentionally manual |
| `Skipped` | Automated but currently skipped |
| `Draft` | Expected behavior or finding is unresolved |
| `Approved` | Authoring lifecycle state |
| `Deprecated` | Retired; Zephyr has no delete |

Do not use `AQA In Progress` in this workflow; move an existing case directly to `Automated`. `set-status` performs a server-side read-modify-write because Zephyr replaces the whole case, but it is not atomic; do not loop it over cases someone is actively editing.

## Execution reporting

- `codeceptjs-e2e` reports executions in CI through `tests/helper/reporter_helper.js`.
- `e2e_tests` Playwright does not have a Zephyr reporter. Keep the key for traceability, but do not promise a cycle result.

Approved designed cases use `publish.md`; no Zephyr write occurs during design.
