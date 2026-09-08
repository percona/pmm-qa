# candidate: jenkins-pipeline-groovy-testing — prove pipeline helper logic locally before pushing

- Added: 2026-09-08
- Applies to: agents changing `pmm/v3/*.groovy` in Percona-Lab/jenkins-pipelines
- Evidence: extracting two helper methods verbatim by line range and running them under the Groovy that ships with npm-groovy-lint, with `echo`/`catchError` stubbed, proved a branch-distribution change and exposed a factually wrong code comment in the same diff that lint had passed; two mechanical blockers first cost retries — Groovy 3.0.9 aborts with "Unsupported class file major version 65" under the default JDK 21, and `evaluate(new File(...))` does not share method scope with the calling script.
- Proposed change: document the recipe — extract the helpers by line range, concatenate them with a stub script rather than using `evaluate`, and run with the JRE 17 that npm-groovy-lint installs and `JAVA_TOOL_OPTIONS` cleared — as the way to exercise pipeline logic that a Groovy linter cannot check.
