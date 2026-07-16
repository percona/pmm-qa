# Migration Review Checklist

The reviewer performs this checklist twice: before execution and after execution.

## Initial review

### Source coverage

- [ ] Every active executable scenario is migrated.
- [ ] For `already-covered`, every active executable scenario is mapped to existing Playwright coverage.
- [ ] Commented-out scenarios are excluded.
- [ ] Scenario titles and tags are preserved.
- [ ] Data-driven rows and generated titles are preserved.

### Behavior

- [ ] Hooks and suite setup are preserved.
- [ ] Cleanup is preserved.
- [ ] Every assertion is present with equivalent strictness.
- [ ] UI, API, CLI, download, and file behavior is preserved.
- [ ] Reachable custom steps were inspected and mapped.
- [ ] No behavior was added, removed, weakened, or improved.
- [ ] Omitted source syntax is behaviorally redundant.

### Dependencies

- [ ] Source Graphify-linked files were independently inspected.
- [ ] Target Graphify-linked files were independently inspected.
- [ ] Missing or stale graph edges were accounted for.
- [ ] Existing Playwright abstractions were reused where applicable.
- [ ] New fixtures, POMs, API clients, or endpoints are registered.

### Playwright quality

- [ ] No CodeceptJS `I.*` calls remain.
- [ ] Assertions remain visible in test bodies.
- [ ] No arbitrary sleeps or unsupported shortcuts were added.
- [ ] Migrated test files contain zero comments, including ESLint disable comments.
- [ ] No block-level ESLint disable comments were added anywhere in migration-related code.
- [ ] Changed-file ESLint passes.
- [ ] No new TypeScript or full-project ESLint failures were introduced.

### MCP locator verification

- [ ] Every new locator is verified.
- [ ] Every changed locator is verified.
- [ ] Ambiguous reused locators are verified.
- [ ] Locator match count and element identity are correct.
- [ ] Iframe boundaries are correct.
- [ ] No invalid or ambiguous locator remains.

## Initial decision

```text
Missing scenarios: 0
Missing assertions: 0
Missing hooks or cleanup: 0
Missing data rows: 0
Unresolved dependencies: 0
Unverified locators: 0
New TypeScript failures: 0
New ESLint failures: 0
Result: READY_TO_RUN
```

Any non-zero value produces `REVIEW_FAILED` or `LOCATOR_FIX_REQUIRED`.

## Final post-run review

- [ ] Required executions or already-covered regression passed against the final code.
- [ ] Runtime fixes did not weaken or change behavior.
- [ ] Locator fixes still match source intent.
- [ ] The final source and target dependency graphs were checked.
- [ ] No required source dependency was omitted.
- [ ] No target registration is missing.
- [ ] No debug or temporary code remains.
- [ ] No unrelated files or behavior are included.
- [ ] Static validation still introduces zero new failures.
- [ ] The selected CodeceptJS source can be safely retired.

## Final decision

```text
Missing scenarios: 0
Missing assertions: 0
Unresolved dependencies: 0
Unverified locators: 0
Required test execution: PASS
Target regression: PASS or NOT REQUIRED
Result: FINAL_REVIEW_PASS
```
