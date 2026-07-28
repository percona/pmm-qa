---
name: run-e2e
description: Run CodeceptJS or Playwright UI test slice on provisioned PMM. Use when reproducing a specific @tag failure or validating UI after provision.
---

# Run E2E

Input: tags or suite name from FB failure or test plan.

Follow `pmm-qa/.github/workflows/runner-e2e-tests-codeceptjs.yml` pattern. Read `.cursor/skills/pmm-provisioning/SKILL.md` if server not yet up.

Return: pass/fail summary, log excerpts, artifact paths.
