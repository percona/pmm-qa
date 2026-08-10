# Local Provisioning — `provisioning/setup.ts`

Commands, flags, and engine descriptors live in the shared reference
`.agents/workflows/provisioning.md` — read that instead of `provisioning/setup.ts` source.
This file only covers the manual-test-specific decision of *which* `--db` entries a ticket
needs, and how to point that reference at an FB (PR-specific) build.

**Goal for manual tests:** provision a PMM Server + the database engine(s) the ticket
needs, entirely via local Docker — no AWS staging VM, no Jenkins job.

## Deciding which `--db` entries are needed

Don't default to omitting `--db` or to a single arbitrary engine out of habit — walk this
rule (same logic as the old Jenkins `CLIENTS` decision, now emitting `--db` flags instead):

1. **Does the ticket's UI/feature display or depend on monitored-database data** (query
   tables, dashboards, metrics, backups, QAN/RTA)?
   - **No** (pure settings/API/auth/navigation-only change) → server only. See
     `.agents/workflows/provisioning.md`'s "Server-only provisioning" section and omit
     `--db`.
   - **Yes** → continue with `setup.ts --db ...` per the shared reference.
2. **Determine whether the ticket needs one engine or several.** Read the actual scope:
   - Ticket is tied to one engine (an RTA/QAN page, a MySQL-specific advisor) → one `--db`
     entry for that engine.
   - Ticket says "dashboard", "works across databases", lists multiple engines, or touches a
     component shared across MySQL/MongoDB/PostgreSQL (e.g. Node Overview, a cross-engine
     advisor, a generic table/filter component) → one `--db` entry per engine that needs
     verifying, not just one.
3. **Match engine to component:**
   - RTA / QAN → `ps=8.0,query-source=perfschema` or `psmdb=8.0,setup-type=pss` (needs real
     query traffic to populate tables)
   - Backup Management → an engine whose `backup` support matches the mode under test
   - Alerting → whatever engine emits the metric the alert rule reads
4. **Cross-check FB test failures** (`fb-tests.md`) before finalizing — if a suite for an
   engine overlapping the ticket's scope failed, make sure that engine is included.
5. **Fallback** when scope is generic/DB-agnostic but some data is still needed:
   `ps=8.0` alone — cheapest and fastest to provision.

## Testing an FB (PR-specific) build locally

`--server-image` and `--client-version` (see the shared reference for their defaults/format)
accept the same FB artifacts the old Jenkins params did — a ticket's real PR build can be
provisioned locally, not just `dev-latest`. Find both values from the **latest JNKPercona
comment containing `Staging instance:`** on the `pmm-submodules` PR (`pr-review.md` already
resolves that PR number). The `pmm-submodules` PR number often differs from the
`percona/pmm` PR number.

## Login and manual verification

Follow `.agents/workflows/pmmLogin.md` — Basic Auth header via Playwright, **never** the UI
login form — to open the PMM UI and manually walk the ticket's acceptance criteria. Its
default credentials assume `setup.ts`'s default `https://127.0.0.1`, `admin:admin` — see the
shared reference's "Server ready state" section for what changes when `--admin-password` is
set.
