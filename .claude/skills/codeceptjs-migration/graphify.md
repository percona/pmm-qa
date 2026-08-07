# Graphify Discovery

Refresh the Playwright target graph on control before creating a migration branch, then use both Graphify artifacts read-only during migration.

## Graph artifacts (read-only during migration)

```text
codeceptjs-e2e/graphify-out/graph.json   # source side - always read only
e2e_tests/graphify-out/graph.json        # target side - refreshed on control before migration
```

## Pre-migration target graph update

After merging `origin/main` into control and before creating the migration branch, perform one incremental update of the target graph:

```bash
cd e2e_tests
graphify . --update
find graphify-out -type f ! -name graph.json ! -name manifest.json -delete
```

- Run from `e2e_tests/` so output stays in `e2e_tests/graphify-out/`.
- Use `--update` only.
- Keep only `graph.json` and `manifest.json`; delete generated reports, HTML, and `.graphify_*` sidecars.
- Commit only updated `e2e_tests/graphify-out/` files on control.
- Never regenerate the CodeceptJS source graph.
- Create the migration branch from the refreshed control commit.

The publication rebase in `branch-workflow.md` excludes this control-only graph commit from the migration PR.

## Read-only during migration

During writer, reviewer, and runner work (through `FINAL_REVIEW_PASS`):

- do **not** run `graphify`, `/graphify`, or any graph build/extract command;
- do **not** regenerate `graph.json`, `manifest.json`, or other `graphify-out/` artifacts;
- do **not** update `codeceptjs-e2e/graphify-out/`;
- do **not** update `e2e_tests/graphify-out/` again; and
- do **not** include `graphify-out/` files in the migration PR.

Query and inspect the existing JSON graphs only. When a node or edge is missing, follow actual imports and code; record a graph discrepancy. Never block migration waiting for a fresh graph build.

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
- a new target file is not represented yet (expected until its merged PR reaches control through `main` and the next pre-migration refresh runs);
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
