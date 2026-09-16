# qa-integration/pmm_qa/client_container_pxc_setup.sh — PXC 9.x removed wsrep_slave_threads and breaks "grep 8" version guards

- Added: 2026-09-16
- Applies to: pmm-framework PXC version bumps (client_container_pxc_setup.sh and the external pxc-startup.sh it seds)
- Evidence: Adding PXC 9.7 aborted mysqld with "unknown variable 'wsrep_slave_threads=2'" (renamed to wsrep_applier_threads in 9.x); separately the existing 8.x-only workaround was gated `echo "$pxc_version" | grep '8'`, which silently skips 9.x. Fixed by sed-renaming the variable for major>=9 and re-gating the workaround as `!= 5.7`; verified live (PXC 9.7.1 3-node cluster, wsrep_cluster_size=3).
- Proposed change: When bumping PXC to a new major, sed pxc-startup.sh to rename wsrep_slave_threads->wsrep_applier_threads for 9.0+, and express version guards by exclusion or numeric major compare (`${v%%.*}`, `!= 5.7`) rather than substring matches like `grep '8'` that miss later majors.
