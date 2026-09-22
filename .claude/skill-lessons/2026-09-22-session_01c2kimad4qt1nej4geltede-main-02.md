# .claude/agents/investigator.md — distinguish teardown from crash by the failure's transport shape before classifying

- Added: 2026-09-22
- Applies to: target only
- Evidence: The failing run's Playwright trace showed nginx returning HTTP 500 to every request class including static Grafana assets under `/graph/public/`, which is a container mid-shutdown with nginx alive and its upstreams stopped — it was read as a candidate product bug until the Jenkins teardown was found.
- Proposed change: In step 3's classification rules, state the three shapes explicitly: nginx 500 on everything including static assets means the container is shutting down (environment teardown, not a product defect), connection refused means the container stopped, and a connect timeout means the instance is gone.
