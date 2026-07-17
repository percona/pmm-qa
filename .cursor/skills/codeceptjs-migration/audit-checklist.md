# Migration Review Checklist

The reviewer performs this checklist twice: before execution and after execution.

## Initial review

### Source coverage

- [ ] Every active executable scenario is migrated.
- [ ] For `already-covered`, every active executable scenario is mapped to existing Playwright coverage.
- [ ] Commented-out scenarios are excluded.
- [ ] Scenario titles and tags are preserved.
- [ ] Data-driven rows and generated titles are preserved.

### Source fidelity

- [ ] Hooks and suite setup are preserved.
- [ ] Cleanup is preserved.
- [ ] Every assertion is present with equivalent strictness.
- [ ] UI, API, CLI, download, and file behavior is preserved.
- [ ] Reachable custom steps were inspected and mapped.
- [ ] No behavior was added, removed, weakened, or improved.

### Migration rules compliance

- [ ] Every new or edited invocation in migration-related files was checked against `mappings.md` Helpers, CodeceptSyntax, SafeOmission, and Skip policy.
- [ ] No explicit default arguments or options remain when `SKILL.md` or SafeOmission requires omission.
- [ ] No `eslint-disable` was added to work around a rule that must be fixed in code.
- [ ] Assertions remain in test bodies; helpers contain no hidden `expect()` unless `mappings.md` explicitly allows it.

#### SafeOmission registry

| Pattern | Rule |
| --- | --- |
| `parseInt(x, 10)` | Use `parseInt(x)` for decimal version segments. |
| `expect()` inside changed helpers | Only `readZipArchive`-style utilities belong in helpers; assertions stay inline in tests. |
| `pmmTest.skip` without skip-policy comments | Required by `mappings.md` § Skip policy. |
| Copied PR patterns without a rule check | Flag when old code conflicts with current `mappings.md`. |

- [ ] Ran `.cursor/scripts/check-migration-conventions.sh` against the changed migration files.

### Dependencies

- [ ] Source Graphify-linked files were independently inspected.
- [ ] Target Graphify-linked files were independently inspected.
- [ ] Missing or stale graph edges were accounted for.
- [ ] Existing Playwright abstractions were reused where applicable.
- [ ] Reuse changes follow `SKILL.md` section Minimal reuse diffs (expose in place; no duplicate public+private delegates).
- [ ] New fixtures, POMs, API clients, or endpoints are registered.

### Playwright quality

- [ ] No CodeceptJS `I.*` calls remain.
- [ ] No arbitrary sleeps or unsupported shortcuts were added.
- [ ] Helper APIs have no mode flags or union returns unless source behavior truly requires it.
- [ ] Changed migration docs contain ASCII punctuation only.
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
Migration convention violations: 0
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
- [ ] Workflow coverage is preserved or updated for the migrated tags.
- [ ] Old CodeceptJS workflow jobs are kept while active CodeceptJS scenarios still match their tag expression.
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
