# .claude/skills/linode-ha-provisioning/SKILL.md — swapping the chart destroys the relay's external URL

- Added: 2026-09-07
- Applies to: .claude/skills/linode-ha-provisioning/SKILL.md and .claude/skills/ui-evidence/SKILL.md (HA variant)
- Evidence: The relay sets `pmm-ha-haproxy` to type LoadBalancer outside Helm; after the documented `helm upgrade` onto the branch chart, the service reconciled to the chart default ClusterIP, the NodeBalancer went away, and every request to the `url` from `provision.json` failed with `SSL_connect: SSL_ERROR_SYSCALL` / code 000. HAProxy itself was healthy (200 through the in-cluster service). Re-patching the service to LoadBalancer was denied by the permission classifier; `kubectl port-forward svc/pmm-ha-haproxy 18443:443` gave working UI access (login 200, dashboards captured) with no NodeBalancer.
- Proposed change: Note after the chart-swap commands that the swap reverts the HAProxy service to ClusterIP and kills the returned URL, and give `kubectl port-forward svc/pmm-ha-haproxy 18443:443` plus `PMM_URL=https://127.0.0.1:18443` as the post-swap way to reach PMM for `ui-evidence`.
