# Test scope

Use this to turn a ticket and implementation diff into the deployment, dimensions, and regression checks to exercise. Record every decision with a one-line reason.

## Default

Use the default single-server Docker deployment through `linode-docker-provisioning` unless a dimension below applies.

## Dimensions

Add a dimension when either the ticket explicitly requires it or the implementation touches it.

| Dimension | Trigger | Required scope |
| --- | --- | --- |
| High Availability | HA ticket/labels, leader work, shared state, VMAgent scraping, Grafana clustering, `PMM_HA_*`, HA charts/operators | Read `ha-scope.md`, then test HA with `linode-ha-provisioning` |
| Upgrade | Migration, on-disk or `/srv` layout, persisted schema, changed defaults | Seed the previous GA, upgrade, then verify preserved state and a post-upgrade read/write path |
| DB/version matrix | Behavior is specific to a database flavor or version | Provision the named engine/version through `pmm-framework --database` |
| RBAC/access control | Authorization, roles, or access restrictions changed | Exercise a relevant non-admin role and verify denied mutations leave state unchanged |
| Backup/restore | Backup, restore, PBM, or scheduler behavior changed | Perform a real backup and restore; require the database to be queryable afterwards |
| Other topology | A specific integration or network path is part of the changed behavior | Add only that setup and name the causal link |

## Regressions

For runtime, configuration, dependency, permission, data-path, or lifecycle changes, select at most the two strongest causally linked regression checks; add a third only for a materially different risk. A candidate must have meaningful user, integrity, security, compatibility, or monitoring impact and deterministic signal not already covered by an acceptance criterion.

Prefer:

1. Existing behavior using the changed boundary or shared component.
2. Persistence, restart, upgrade, permission, or recovery behavior touched by the change.
3. The nearest supported version, engine, topology, or configuration following the same path.

Record the changed path and intended failure signal. Do not add another dashboard, database, or topology merely because it is nearby; if fewer than two meaningful regressions exist, say why.
