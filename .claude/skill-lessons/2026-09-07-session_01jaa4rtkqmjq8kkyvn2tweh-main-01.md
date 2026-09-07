# AGENTS.md — poll Jenkins through the MCP tools, never curl; an unauthenticated curl returns a login page, not an error

- Added: 2026-09-07
- Applies to: all agents and skills that query the Percona Jenkins fleet
- Evidence: a wait-loop `until curl -sk ".../job/pmm3-rc-testing/32/api/json?tree=building" | grep -o 'true'` was used to wait for a build to finish; pmm.cd.percona.com redirects unauthenticated API calls to `/securityRealm/commenceLogin` and returns HTML, so the grep never matched, the loop exited in under a second, and the wait silently did nothing.
- Proposed change: state that Jenkins reads and waits go through the `Percona_Jenkins_MCP` tools (`get_build`, `get_build_stages`, `get_running_builds`, `get_all_queue_items`, `get_all_nodes`), which carry auth, and that a timed wait is a bare backgrounded `sleep N` followed by a re-check through those tools — never a curl-and-grep loop against the Jenkins host.
