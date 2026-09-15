# qa-integration/pmm_qa/client_container_pxc_setup.sh — MySQL 8.4+ disables mysql_native_password by default

- Added: 2026-09-15
- Applies to: pmm-framework DB version bumps (MySQL family), also qa-integration/pmm_qa/pxc-startup.sh sysbench_prepare
- Evidence: Registering PXC 8.4.10 failed with "ERROR 1524 (HY000): Plugin 'mysql_native_password' is not loaded" on `CREATE USER ... identified with mysql_native_password`; the plugin is OFF by default from 8.4, and adding the version only to lib/config.sh + product_version_download_helper passed unit tests but failed at runtime on a live VM.
- Proposed change: When adding a MySQL-family major >= 8.4, enable the auth plugin at server start (e.g. PXC_MYEXTRA="--mysql-native-password=ON", gated so 5.7/8.0 stay untouched) and verify a version bump by provisioning and running the setup on a real VM, not by unit tests alone.
