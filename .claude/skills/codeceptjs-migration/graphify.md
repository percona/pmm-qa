# Graphify Discovery

Refresh both the CodeceptJS source graph and the Playwright target graph on control before starting the migration's own commits, then use both Graphify artifacts read-only during migration. Migration work happens in control's worktree and is committed only on the publish branch; see `branch-workflow.md`.

## Graph artifacts (read-only during migration)

```text
codeceptjs-e2e/graphify-out/graph.json   # source side - refreshed on control during preflight; read-only during migration
e2e_tests/graphify-out/graph.json        # target side - refreshed on control during preflight; read-only during migration
```

## Pre-migration graph updates

After merging `origin/main` into control and before marking the tracker row `in-progress`, perform one incremental update of each graph.

Drive this through the **`graphify` skill's own update flow** (`.claude/skills/graphify/references/update.md`), once from `e2e_tests/` and once from `codeceptjs-e2e/`. Do not shell out to a bare `graphify . --update`: that CLI path demands an LLM API key as soon as any changed file is a doc, and stops with an error that looks like a hard blocker.

It is not one. Per `.claude/skills/graphify/SKILL.md`, graphify needs no API key and you must never block on or ask for one. Code is extracted structurally by AST with no LLM at all; semantic extraction applies only to docs, papers, and images, and when `GEMINI_API_KEY`/`GOOGLE_API_KEY` is unset the host agent performs it (the `code_only: False` path in `update.md`). `ANTHROPIC_API_KEY` is never read.

- **Never pass `--code-only` to step past a changed doc.** It suppresses the error by skipping the file, which silently leaves that node stale in a graph you are about to commit as refreshed. `--code-only` is legitimate only when the changed set genuinely contains no docs, papers, or images, which is also the case where it changes nothing.
- If `steps.d.ts` is among the changed files, run a full build instead of an incremental one. The CodeceptJS injection registry can rebind unchanged consumers, and their old edges cannot be replaced safely from a changed-files-only fragment.
- Run each update from its own root (`e2e_tests/` or `codeceptjs-e2e/`) so output stays in that directory's `graphify-out/`.
- Keep only `graph.json` and `manifest.json`. Delete generated reports, HTML, and `.graphify_*` sidecars, and delete the dated backup directory (`graphify-out/<YYYY-MM-DD>/`) that a curated-graph rebuild leaves behind - it holds its own `graph.json`/`manifest.json`, so a name-based `find ... -delete` skips it and it lands in the commit.
- The cleanup above removes `graphify-out/.graphify_python`, which the graphify skill's own bash blocks read to locate their interpreter. That is fine: the skill recreates it in its setup step. It does mean you must enter that flow at the beginning rather than jumping straight to an `update.md` snippet, because the `graphify` CLI does not regenerate that sidecar.
- Commit each graph's updated files on control in its own commit, before the tracker row's `in-progress` commit.
- If a refresh produces no changes, do not create an empty commit for it.
- Refresh once on control during preflight; never regenerate either graph during migration (see "Read-only during migration").

Both graph commits stay on control only. The publish branch is cut from `origin/main` and carries just the migrated code, its coverage, and the source retirement (see `branch-workflow.md`), so neither graph commit can reach the migration PR - not because a later step removes it, but because it was never on that branch.

## Read-only during migration

During writer, reviewer, and runner work (through `FINAL_REVIEW_PASS`):

- do **not** run `graphify`, `/graphify`, or any graph build/extract command;
- do **not** regenerate `graph.json`, `manifest.json`, or other `graphify-out/` artifacts;
- do **not** update `codeceptjs-e2e/graphify-out/`;
- do **not** update `e2e_tests/graphify-out/` again; and
- do **not** include `graphify-out/` files in the migration PR.

Query and inspect the existing JSON graphs only. When a node or edge is missing, follow actual imports and code; record a graph discrepancy. Never block migration waiting for a fresh graph build.

Query via the `graphify query`/`graphify path`/`graphify explain` CLI, or a targeted `python -c` filter over `graph.json` run through Bash (see `.claude/skills/graphify/references/query.md`). Never load a full `graph.json` into context with the Read tool - these files run into the hundreds of thousands of tokens, and a targeted query only costs the size of its filtered output.

`graph.json` is NetworkX node-link JSON. A hand-written filter needs these keys: edges are `links` (**not** `edges`, which does not exist - reading it reports 0 and looks like an empty graph), a node's path is `source_file` (not `path`), `hyperedges` is a third container a `links`-only filter misses, and `built_at_commit` gives the graph's staleness without a guess.

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
