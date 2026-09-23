# Evals

Read this when changing this skill.

`evals/evals.json` holds real-ticket prompts with mechanism-based expectations; `evals/trigger-queries.json` holds prompts that should and should not load this skill.

After changing this skill, snapshot the previous version and run the core evals — ids 1, 3, 4, 7, 10 and 11 — with the `skill-creator` skill, once with the snapshot as the baseline and twice with the change. Run every eval after a change to the workflow steps, the gate, or the coverage classes. Eval runs stop at step 9: no Zephyr or Jira writes. Record each run's tokens and duration beside its grades; the depth tiers exist to cut them.

Grade by the failure mechanisms a draft covers, the findings it states, the unsupported cases it avoids, the coverage it subtracts, and the layer it chooses — never by case count: two drafts that group the same checks differently have converged. Reject a change that adds a generic, duplicate, or unsupported case on any eval, and drop an expectation that passes on the baseline and the change alike. Each expected output names the date its facts were checked; when the ticket or its pull request has changed since, re-check those facts before grading. After changing the description, run the trigger queries through skill-creator's description optimization.
