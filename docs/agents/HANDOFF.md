# Handoff — dev → QA (Fase 3)

## Within one run (orchestrator)

Test Runner delegates to workers in `.cursor/agents/`:

1. `read-git-diff` — scope from PRs
2. `provision-pmm` — server + DBs
3. `run-e2e` or `run-cli` — targeted suites

**Prerequisite:** [VALIDATION.md](VALIDATION.md) items 3–4 pass on cloud.

## Between runs (PR labels)

Use GitHub Automation triggers (documented):

```mermaid
flowchart LR
    devPR["Dev PR on percona/pmm"] -->|label qa:e2e| runner["Test Runner automation"]
    runner -->|pass| review["Ready for review"]
    runner -->|fail label qa:failed| healer["Test Healer"]
    healer --> fixPR["PR on pmm-qa"]
```

### Label conventions

| Label | Meaning |
|-------|---------|
| `qa:e2e` | Request Test Runner cloud QA on this PR |
| `qa:failed` | QA failed — trigger Healer triage |

### Automation setup

1. GitHub → PR label changed → `percona/pmm` or `percona/grafana`
2. Filter label `qa:e2e`
3. Pointer prompt → `test-runner.md` with PR context from event

Repeat for `qa:failed` → `test-healer.md`.

## Future: dev-implementer role

Add `.cursor/agents/dev-implementer.md` + skills; no dispatcher needed — `/dev-implementer` or auto-delegation by description.

Cloud environment `PMM` already includes `pmm` + `pmm-qa` for compile + e2e in one VM.
