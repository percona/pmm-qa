---
name: test-scope
description: Decide what a PMM change actually requires testing — which deployment mode (single-server Docker vs HA), and any extra dimensions (upgrade path, DB/version matrix, RBAC, backups). Use during QA planning, before provisioning, to pick the right environment and avoid both under-testing a regression and over-provisioning for a change that doesn't need it.
---

# Test scope — what does this change need?

Read this when planning QA, **before** provisioning. It turns a ticket + diff into a short list of what to actually exercise, and which provisioning skill each item implies. The goal is to catch the dimensions a plain single-server run would miss, without spinning up expensive environments a change doesn't need.

Inputs you already have by this point: the Jira ticket (summary, AC, labels/components, dev comments) and the `percona/pmm` / `percona/grafana` diff (`git-diff` skill).

## Default

Unless a dimension below applies, the change is tested on the **default single-server Docker** deployment — `linode-docker-provisioning`. Most fixes (one exporter metric, a dashboard panel, a CLI flag, a UI page with no clustered state) live here and need nothing more.

## Dimensions to check

For each, two questions: **does the ticket say so** (labels, AC, an explicit note), and **does the diff touch it**. If either is yes, add it to the plan and note why.

| Dimension | Spot it by | Then |
|-----------|-----------|------|
| **High Availability** | ticket flags HA; diff touches leader-elected services, shared/externalised state, VMAgent scraping, Grafana clustering, `PMM_HA_*`, or the `pmm-ha` charts/operators | test on HA — `linode-ha-provisioning`. Full criteria: [references/ha.md](references/ha.md) |
| **Upgrade** | ticket is about upgrade/migration; diff adds a DB migration, changes on-disk/`/srv` layout, or default settings | provision the **previous** GA, then upgrade to the build under test and re-verify (single-server unless the change is also HA) |
| **DB / version matrix** | change is specific to a DB flavour or version (MySQL 8.4, MongoDB PSMDB, PG 16, etc.) | provision the specific engine/version the ticket names via `pmm-framework --database`; don't only test the default |
| **RBAC / access control** | diff touches `managed/services/...` authz, roles, or the ticket is about access restrictions | test with a non-admin role, not just admin |
| **Backups / restore** | diff touches backup/restore, PBM, or the scheduler | run an actual backup+restore, not just that the button renders |

This list is not exhaustive — it's the recurring ones. If the diff plainly needs some other setup (a specific external integration, a network topology), add it and say so in the plan.

## Record the decision

Put the outcome in the test plan and the Jira report: the deployment mode chosen and each extra dimension, each with a one-line reason. "Not HA-impacted — change is a single dashboard panel" is a valid, useful line; a silent omission isn't. When in doubt on a dimension that's cheap to add, prefer testing it and say why — a false positive costs a little setup; a false negative ships a regression.
