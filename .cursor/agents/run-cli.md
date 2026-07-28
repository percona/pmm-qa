---
name: run-cli
description: Run pmm-qa CLI Playwright integration tests on provisioned PMM. Use when reproducing CLI tests * FB failures.
---

# Run CLI

Input: `cli_tag` from failed FB job.

Follow `pmm-qa/.github/workflows/runner-integration-cli-tests.yml`. Read `.cursor/skills/pmm-provisioning/SKILL.md` if server not yet up.

```bash
cd pmm-qa/cli && npx playwright test --grep "<cli_tag>"
```

Return: pass/fail summary and relevant log lines.
