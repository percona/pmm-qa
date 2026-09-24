# .claude/skills/linode-docker-provisioning/SKILL.md — Target the spec file when replaying a CLI/Integration job on the VM

- Added: 2026-09-24
- Applies to: CLI (`cli/`) reproductions on the Linode VM, investigator and test-runner
- Evidence: `npx playwright test --grep @proxysql` over the whole `cli/` project died before any test ran, because `cli/tests/generic.spec.ts` runs `sudo pmm-admin status --json` at module load and the VM host has no pmm-admin (CI installs pmm-client on the runner host); passing `tests/proxySql.spec.ts` explicitly ran 12/12.
- Proposed change: In the databases/tests section, say that CLI suites on the VM are run with the spec file(s) named explicitly (`npx playwright test --grep <tag> tests/<file>.spec.ts`), mirroring CI, which passes only the Launchable subset file list.
