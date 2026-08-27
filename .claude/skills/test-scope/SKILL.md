---
name: test-scope
description: "Decide PMM QA scope: deployment mode, upgrade/DB/RBAC/backup dimensions, and causally linked regression checks. Use for planning what to exercise in local, existing, or newly provisioned environments; do not use to judge whether direct evidence is deep enough."
---

# Test scope — what does this change need?

Read this when planning QA. It turns a ticket + diff into a short list of what to actually exercise, and which environment or provisioning skill each item implies. The goal is to catch the dimensions a plain single-server run would miss, without spinning up expensive environments a change doesn't need.

Inputs you already have by this point: the Jira ticket (summary, AC, labels/components, dev comments) and the `percona/pmm` / `percona/grafana` diff (`git-diff` skill).

## Default

Unless a dimension below applies, the change is tested on the **default single-server Docker** deployment — `linode-docker-provisioning`. Most fixes (one exporter metric, a dashboard panel, a CLI flag, a UI page with no clustered state) live here and need nothing more.

## Dimensions to check

For each, two questions: **does the ticket say so** (labels, AC, an explicit note), and **does the diff touch it**. If either is yes, add it to the plan and note why.

| Dimension | Spot it by | Then |
| ----------- | ----------- | ------ |
| **High Availability** | ticket flags HA; diff touches leader-elected services, shared/externalised state, VMAgent scraping, Grafana clustering, `PMM_HA_*`, or the `pmm-ha` charts/operators | test on HA — `linode-ha-provisioning`. Full criteria: [references/ha.md](references/ha.md) |
| **Upgrade** | ticket is about upgrade/migration; diff adds a DB migration, changes on-disk/`/srv` layout, or default settings | provision the **previous** GA, then upgrade to the build under test and re-verify (single-server unless the change is also HA) |
| **DB / version matrix** | change is specific to a DB flavour or version (MySQL 8.4, MongoDB PSMDB, PG 16, etc.) | provision the specific engine/version the ticket names via `pmm-framework --database`; don't only test the default |
| **RBAC / access control** | diff touches `managed/services/...` authz, roles, or the ticket is about access restrictions | test with a non-admin role, not just admin |
| **Backups / restore** | diff touches backup/restore, PBM, or the scheduler | run an actual backup+restore, not just that the button renders |
| **High-risk regressions** | runtime code, configuration, dependency, permission, data path, or lifecycle behavior changed | add the two strongest causally linked checks below; add a third only for a materially different risk |

This list is not exhaustive — it's the recurring ones. If the diff plainly needs some other setup (a specific external integration, a network topology), add it and say so in the plan.

## Select high-risk regressions

Regression selection belongs here; [verification-depth](../verification-depth/SKILL.md) decides how deeply to prove each selected direct check.

Choose a regression only when the diff gives it a plausible causal link, failure would materially affect users, integrity, security, compatibility, or monitoring availability, and the check gives deterministic signal not already covered by an acceptance criterion. Rank candidates from the changed boundary and shared callers, relevant FB/CI failures, existing tests, and prior bugs. Prefer:

1. Existing behavior using the same changed boundary or shared component.
2. Persistence, restart, upgrade, permission, or recovery behavior touched by the change.
3. The nearest supported version, engine, topology, or configuration following the same code path.

Record the changed path and intended failure signal for each selected regression. Do not invent broad checks such as another dashboard or database without a shared dependency; if fewer than two meaningful regressions exist, record why.

## Record the decision

Put the outcome in the test plan and Jira report: the deployment mode, each extra dimension, and each selected regression, all with a one-line reason. "Not HA-impacted — change is a single dashboard panel" is useful; a silent omission is not. When a dimension is cheap and genuinely plausible, prefer testing it and state why.
