# .claude/skills/linode-ha-provisioning/SKILL.md — from a cloud session, reach a fresh install_pmm_ha.sh LoadBalancer by its linodeusercontent hostname, not a port-forward

- Added: 2026-09-24
- Applies to: target only
- Evidence: `k8s/install_pmm_ha.sh --platform lke --chart-branch PMM-HA-GA --external-access` exited 1 after 10 min on `PMM did not answer 200 on https://<LB IP>/v1/readyz` although every pod was Ready (the egress proxy refuses bare IPs), while `https://<ip-with-dashes>.ip.linodeusercontent.com/v1/readyz` answered 200; `kubectl port-forward svc/pmm-ha-haproxy` pins one HAProxy pod, so it cannot carry tests that scale or drain HAProxy.
- Proposed change: In the fresh-install path, say to treat that readyz failure as the proxy, verify through the dashed linodeusercontent hostname of the new LoadBalancer IP, and use that as PMM_UI_URL instead of a port-forward.
