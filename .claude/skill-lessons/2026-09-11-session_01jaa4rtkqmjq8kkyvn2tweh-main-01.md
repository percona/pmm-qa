# candidate: jenkins-builds — Blue Ocean draws a stage with no steps as never run

- Added: 2026-09-11
- Applies to: candidate: jenkins-builds
- Evidence: Mirrored child stages that only contained a conditional catchError rendered hollow in Blue Ocean whenever the child succeeded, while the stage-view REST API reported them SUCCESS; PipelineNodeGraphVisitor assigns NOT_EXECUTED to a chunk with no executed step node.
- Proposed change: When generating stages programmatically, give every stage at least one step (an echo with the status and a link is enough) and judge rendering from Blue Ocean's graph rather than from the wfapi stage status.
