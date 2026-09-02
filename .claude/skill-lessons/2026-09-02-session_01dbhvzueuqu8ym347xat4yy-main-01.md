# .claude/skills/verification-depth/SKILL.md — verify a cloud resource's deletion by immutable id after the reconcile interval, not by its attribution tag

- Added: 2026-09-02
- Applies to: all skills (cloud teardown/cleanup verification)
- Evidence: A teardown check that queried "residual by our run tag" immediately after cluster-delete reported clean, but a Linode controller had already stripped that tag and the NodeBalancer had actually leaked; re-checking with GET on the resource id (expecting 404) after the drain interval exposed the leak.
- Proposed change: To confirm a cloud resource is gone, GET it by immutable id and require 404 after the controlling reconcile/drain interval; never treat "no match by a mutable or controller-managed tag" as proof of deletion.
