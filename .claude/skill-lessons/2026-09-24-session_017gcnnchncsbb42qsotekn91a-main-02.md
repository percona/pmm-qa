# .claude/skills/linode-docker-provisioning/SKILL.md — Clear the previous version's PMM node before a second same-DB setup on one box

- Added: 2026-09-24
- Applies to: version-matrix reproductions (e.g. pxc=5.7 then pxc=8.0) on one VM
- Evidence: A second `pmm-framework --database pxc=8.0` run failed at `docker run ... -p 6033:6033` while the 5.7 container still held the port; after `docker rm -f` of that container its suite cleanup never ran, and 3 of 12 `@proxysql` tests failed with `Service with name "..." already exists` until the orphan node was deleted via `DELETE /v1/inventory/nodes/<id>?force=true`.
- Proposed change: Add a short note: before setting up another version of the same DB type on the box, remove the previous container and force-delete its PMM node (`/v1/inventory/nodes/<id>?force=true`), otherwise leftover services make the next suite fail with "already exists".
