# .claude/agents/investigator.md — a Playwright trace's `trace.network` carries API request and response bodies; its DOM snapshots cannot prove absence

- Added: 2026-09-08
- Applies to: .claude/agents/investigator.md
- Evidence: Two hypotheses for a nightly `@qan` failure were built on values missing from the trace's `frame-snapshot` HTML and both were wrong — those snapshots are incremental, with unchanged subtrees stored as `[[ref, n]]` back-references, so an absent value only means "unchanged since an earlier snapshot". The same trace's `trace.network` settled the root cause outright: three consecutive `metrics:getFilters` calls, whose request and response bodies sit in `resources/<sha1>.json` keyed by `postData._sha1` and `response.content._sha1`, showed which filter was still applied when the test read its candidate list.
- Proposed change: In the CI/FB trigger sections, direct that a trace's `trace.network` (request/response bodies resolved through the `_sha1` names under `resources/`) be read before reasoning from `frame-snapshot` HTML, and warn that those snapshots are incremental so a value absent from one is not evidence it was absent from the DOM.
