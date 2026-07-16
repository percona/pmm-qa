---
name: codeceptjs-migration
description: Migrate one CodeceptJS test to native Playwright, verify completeness and locators, execute it, open a PR, and mark the tracker done.
---

# CodeceptJS to Playwright Migration

Migrate exactly one CodeceptJS source test at a time.

## Required outcome

A migration is complete only when:

1. all active behavior from the selected CodeceptJS source is represented in Playwright;
2. the initial independent review passes;
3. migration-related locators are verified through MCP;
4. the migrated test passes;
5. the complete target file passes when an existing file was modified;
6. the final independent review passes;
7. a PR targeting `main` is opened; and
8. the tracker row is updated to `done`.

For this workflow, `done` means the PR is open for review. Merge is not required.

## Migration invariants

Preserve exactly:

- every active executable scenario;
- scenario titles and tags;
- hooks, suite setup, and cleanup;
- data-driven rows and generated test titles;
- assertions and assertion strictness;
- API, CLI, UI, download, and file-check behavior;
- ordering when it affects behavior.

Do not add, remove, weaken, or improve coverage during migration.
Preserve behavior, not redundant syntax. Omit arguments/options only when they restate a default and removal is behaviorally identical for the migrated values.
When unsure, keep the source syntax.

## Native Playwright rules

- Use `pmmTest` and existing fixtures.
- Use Playwright `Locator` objects for UI elements.
- Keep Playwright assertions visible in test bodies.
- Reuse existing POMs, helpers, components, API clients, fixtures, and test data.
- Add target registrations only when required.
- Keep URLs in the repository's existing POM structure.
- Use repository timeout constants when an explicit timeout is necessary.
- Do not retain CodeceptJS `I.*` calls or recreate an actor abstraction.
- Do not hide assertions inside POMs or helpers.
- Do not suppress `playwright/expect-expect` to compensate for hidden assertions.
- Do not add comments of any kind in migrated test files (`*.test.ts`), except the required skip-policy comments in `mappings.md`.
- If a lint rule fails in a test, refactor the test or move the behavior into an existing/new helper, POM, component, or API client where appropriate.
- Do not migrate `.retry(N)`.
- Do not migrate commented-out scenarios.
- Migrate an explicitly skipped active scenario only according to the repository's established Playwright skip policy. Stop when no policy exists rather than inventing one.

## Graphify rule

Use the **existing** graphs in `codeceptjs-e2e/graphify-out/graph.json` and `e2e_tests/graphify-out/graph.json` to discover linked files. Do not run graphify or regenerate graphs during migration. Graphify is a discovery aid only. Open and inspect every behaviorally relevant file. Actual repository code is authoritative when it conflicts with the graph. During publish, after `FINAL_REVIEW_PASS`, the runner updates only `e2e_tests/graphify-out/` with `graphify . --update` from `e2e_tests/`. See `graphify.md`.

## Agent responsibilities

- `pmm-migration-writer`: graph discovery, migration, and static validation.
- `pmm-migration-reviewer`: independent completeness review, MCP locator verification, locator-only corrections, and final review.
- `pmm-migration-runner`: execution, failure evidence, publication, PR creation, and tracker completion.

The canonical sequence is defined in `run.md`.
