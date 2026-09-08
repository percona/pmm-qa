# .claude/agents/investigator.md — Read the apt/yum repository index, not the pool listing, to decide what is installable

- Added: 2026-09-08
- Applies to: target only
- Evidence: The flat `pool/main/p/<pkg>/` listing omitted several published versions; the `dists/<distro>/<component>/binary-<arch>/Packages` index enumerated what was actually installable and its `Filename:` lines showed other versions living under a different component's pool path.
- Proposed change: In the external-fetch paragraph, name the `dists/.../Packages` index (per component) as the authoritative source for package availability, and note that a pool directory listing is pruned and component-specific.
