# .claude/agents/router.md — A CI coverage count must expand reusable workflows and matrices to leaf jobs before quoting a number

- Added: 2026-09-17
- Applies to: all agents that answer "how many jobs/tests does pipeline X run" from Groovy or GitHub Actions YAML
- Evidence: A direct Slack answer quoted "~70 leaf jobs" for rc-testing-suite.yml by counting each `uses:` reusable workflow as one job; expanding integration-cli-tests.yml (29 jobs) times its 5-version compat matrix alone gave 145, and the true total was 237, after the user had already said they no longer trusted the numbers.
- Proposed change: Add a rule that a job or combination count from pipeline source recursively expands every `uses:` reusable workflow, `strategy.matrix`, and Jenkins `parallel`/`build job:` child to the leaf job, multiplies by the matrix size, and states the counting depth (top-level vs leaf) in the answer.
