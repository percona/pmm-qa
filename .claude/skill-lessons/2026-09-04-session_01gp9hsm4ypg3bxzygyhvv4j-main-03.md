# .claude/agents/investigator.md — read the nightly run's deployment type before comparing it to a green run

- Added: 2026-09-04
- Applies to: target only
- Evidence: Two nightly runs on the identical pmm-qa commit and identical PMM Server image, two hours apart, differed only in deployment: the `helm` target passed with zero failures and the `ha` target failed 52 tests. The type is not in the run's title or API metadata — only `INSTALLATION_TYPE` and `SERVER_IP` in the job logs reveal it, because the dispatching Jenkins job rotates `SERVER_TYPE` over docker/ami/helm/ha. Reading it first turned "the merged commit broke nightly" into "HA-specific", and gave the report its control case.
- Proposed change: In the CI-trigger step, require reading `INSTALLATION_TYPE` and `SERVER_IP` out of the failed run's logs, and comparing against the most recent run of the *same* deployment type rather than the previous run.
