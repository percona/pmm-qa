# .claude/skills/fb-tests/SKILL.md — the failed job's artifact is the fastest product-vs-test evidence

- Added: 2026-09-02
- Applies to: target only
- Evidence: For a red `@fb-instances` job the uploaded `artifacts_for_@<tag>` archive contained the CodeceptJS failure screenshot, two Playwright traces (one per `retry(1)` attempt) and the whole PMM Server log set; two greps of its `pmm-managed.log` (`CheckConnectionRequest` / `ServiceInfo response` around the failing add) showed the monitored database really held the object the test asserts was missing, settling "product bug vs QA setup" before any VM was provisioned. The skill's "Map failures to workflows" section stops at the workflow/inputs mapping and never mentions the artifact.
- Proposed change: Add an artifact step to "Map failures to workflows": take the artifact id from the failing job's upload-artifact step (or `actions_list` `list_workflow_run_artifacts`), fetch a download link with `actions_get` `download_workflow_run_artifact`, and read `logs/pmm-managed.log` plus `logs/client/pmm-agent/*` and `tests/output/*.png` from it before deciding whether the product or the setup is at fault.
