# candidate: jenkins-builds — Run the local Groovy harness over pipeline helpers before pushing

- Added: 2026-09-11
- Applies to: candidate: jenkins-builds
- Evidence: A stubbed-DSL Groovy harness (java -cp groovy.jar groovy.ui.GroovyMain, stubs for stage/echo/catchError/build) run over the orchestrator's mirrorChild found that a declarative child's post-actions stage runs after a failure, so a tail-only "stages skipped" collapse mirrored never-run stages as green; the bug was fixed before the PR instead of after the next nightly.
- Proposed change: For any change to stage-generating pipeline code, run a stub harness over the helper with a success, a mid-failure and an aborted fixture and paste the rendered stage tree into the PR verification section; no Jenkins run is needed for that check.
