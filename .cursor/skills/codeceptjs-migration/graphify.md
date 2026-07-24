# Graphify Discovery

Use the **existing** Graphify artifacts for discovery during migration. Do not generate or rebuild graphs while migrating.

## Graph artifacts (read-only during migration)

```text
codeceptjs-e2e/graphify-out/graph.json   # source side - read only; never regenerate during migration
e2e_tests/graphify-out/graph.json        # target side - read during migration; update on control after publish
```

## Do not generate graphs during migration

During writer, reviewer, and runner work (through `FINAL_REVIEW_PASS`):

- do **not** run `graphify`, `/graphify`, or any graph build/extract command;
- do **not** regenerate `graph.json`, `manifest.json`, or other `graphify-out/` artifacts;
- do **not** update `codeceptjs-e2e/graphify-out/` as part of the migration workflow;
- do **not** update `e2e_tests/graphify-out/` until the migration PR is open and its frozen branch has been merged into control.

Query and inspect the existing JSON graphs only. When a node or edge is missing, follow actual imports and code; record a graph discrepancy. Never block migration waiting for a fresh graph build.

## Post-migration target graph update (control branch)

Only after `FINAL_REVIEW_PASS`, the migration PR is open, and the frozen migration branch is merged into control, the runner performs one incremental update of the **target** graph there:

```bash
cd e2e_tests
graphify . --update
find graphify-out -type f ! -name graph.json ! -name manifest.json -delete
```

- Run from `e2e_tests/` so output stays in `e2e_tests/graphify-out/`.
- Use `--update` only (incremental re-extract of new/changed files).
- Keep only `graph.json` and `manifest.json`; delete generated reports, HTML, and `.graphify_*` sidecars after the update.
- Commit updated `e2e_tests/graphify-out/` files with the tracker update on control; do not amend the migration PR with graph artifacts.
- Do not regenerate the CodeceptJS source graph in this workflow.

## Source discovery

Start from the selected CodeceptJS test and query `codeceptjs-e2e/graphify-out/graph.json` for reachable files that affect executable behavior. If the tracker source exists on disk but is missing from the graph, continue from the actual file and record the missing root as a graph discrepancy:

- imported modules;
- `Before`, `After`, `BeforeSuite`, and `AfterSuite` dependencies;
- page objects and methods they call;
- `custom_steps.js` methods;
- helpers;
- API objects and endpoint constants;
- test data, fixtures, and imported constants;
- setup and cleanup dependencies;
- indirect calls reached from any of the above.

## Target discovery

Query `e2e_tests/graphify-out/graph.json` from the selected or candidate Playwright test for reusable or required files:

- existing test files for the same feature;
- POMs;
- fixtures;
- components;
- helpers;
- API clients and endpoint definitions;
- test data;
- registration files.

Use behavior, page, hooks, fixtures, and environment compatibility to choose the target. Do not choose by filename alone.

## Required process

1. Query the relevant **existing** graph from the root file.
2. Record all reachable behaviorally relevant paths.
3. Open the actual files.
4. Follow calls that the graph did not resolve.
5. Compare graph paths with imports and runtime registrations.
6. Record stale, missing, or incorrect edges.
7. Trust actual code over graph output.

## Stale graph handling

Treat a graph as stale or incomplete when:

- the root file is missing;
- the tracker source exists on disk but is missing from the graph, including when the graph only contains an old renamed node such as `*_migrated.js`;
- a graph path no longer exists;
- an actual import or call is absent from the graph;
- a new target file is not represented yet (expected until post-migration `--update`);
- an edge conflicts with current code.

Do not block a migration merely because the graph is incomplete when the dependency can be proven from actual code. Trust filesystem paths, source imports, and runtime registrations over graph output. Record the discrepancy in the handoff, for example: `source graph has leftNavigation_migrated.js but tracker source is leftNavigation_test.js`.

## Required report

```yaml
sourceGraph:
  root:
  inspectedFiles: []
  graphDiscrepancies: []
targetGraph:
  root:
  inspectedFiles: []
  reusedFiles: []
  changedFiles: []
  graphDiscrepancies: []
```
