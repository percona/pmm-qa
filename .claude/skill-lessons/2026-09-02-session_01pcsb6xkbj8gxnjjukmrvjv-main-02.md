# .claude/skills/fb-tests/SKILL.md — never retype a signed download URL

- Added: 2026-09-02
- Applies to: any signed artifact/log download URL
- Evidence: A `download_workflow_run_artifact` link pasted into a `curl -o` command lost part of its `sig=` value in shell quoting and returned a 408-byte XML body — `<Code>AuthenticationFailed</Code> ... Signature fields not well formed` — which `unzip` then reported as "not a zipfile"; re-issuing it verbatim from a quoted heredoc via `curl -K` downloaded the archive on the first try.
- Proposed change: Where the artifact/run-log download is documented, require writing the returned URL verbatim into a file with a quoted heredoc and passing it as `curl -sS -o out.zip -K <(printf 'url = "%s"\n' "$(cat url.txt)")`, and note that an `AuthenticationFailed`/"not a zipfile" pair means a mangled signature, not an expired link.
