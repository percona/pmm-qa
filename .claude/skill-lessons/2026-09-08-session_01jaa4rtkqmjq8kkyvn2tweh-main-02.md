# candidate: jenkins-builds — read the pipeline from the branch the job's SCM config points at, not the working branch

- Added: 2026-09-08
- Applies to: all agents diagnosing a Jenkins run (investigator, test-runner, fb-reporter)
- Evidence: the same false finding was produced twice in one session — once by the main agent and once by a subagent, which shipped it in a PR body as a DevOps action item — by grepping a Jenkinsfile in the working checkout of a long-lived feature branch and concluding an agent label was hardcoded, so a parameter had not routed 13 of 50 suites. The jobs read `*/master`, whose copies of both files carry the correct `params.USE_ONDEMAND ? ... : ...` ternary; the feature branch was three commits behind and held the pre-merge copies.
- Proposed change: require that a claim about what a Jenkins build executed be read from the ref named in that job's own SCM config (`get_item_config`) rather than the working branch, and add that a feature branch left behind its base manufactures false findings, so merging the base in is a correctness step before diagnosing from it.
