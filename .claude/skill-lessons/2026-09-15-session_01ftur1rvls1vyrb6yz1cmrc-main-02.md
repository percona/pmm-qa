# qa-integration/pmm_qa/client_container_pxc_setup.sh — prefer upstream ProxySQL over re-enabling mysql_native_password for PXC 8.4

- Added: 2026-09-15
- Applies to: PXC 8.4+ setup (client_container_pxc_setup.sh, pxc_proxysql_setup.yml, pmm-framework setup_pxc); refines the 8.4 mysql_native_password lesson (-main-01)
- Evidence: The native_password requirement on PXC 8.4 came from Percona's proxysql-admin (hardcodes `IDENTIFIED WITH mysql_native_password`, fails with "Plugin 'mysql_native_password' is not loaded"); a sha2-only variant proved it by failing at the same proxysql-admin step. Fronting 8.4 with upstream ProxySQL 3.0.11 (which monitors caching_sha2_password backends) let the whole cluster use caching_sha2 — verified live: ProxySQL backends ONLINE, monitor connect_success, proxysql_up=1.
- Proposed change: For a new MySQL-family major that disables mysql_native_password, prefer switching the dependent tooling (e.g. upstream ProxySQL 3.x, which has no proxysql-admin — configure it via the 6032 admin interface) over re-enabling the deprecated plugin; note upstream ProxySQL debs ship only the proxysql binary + /etc/proxysql.cnf.
