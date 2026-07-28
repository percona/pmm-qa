---
name: provision-pmm
description: Provision PMM server and databases on the cloud VM for a ticket. Use when Test Runner needs isolated provisioning work.
---

# Provision PMM

Read `.cursor/skills/pmm-provisioning/SKILL.md` and execute for the ticket's `DOCKER_ENV_VARIABLE`, `CLIENT_VERSION`, and `--database` plan.

Return: readyz status, containers running, any BLOCKED escalation with Jenkins parambuild URL if MicroVM setup fails.
