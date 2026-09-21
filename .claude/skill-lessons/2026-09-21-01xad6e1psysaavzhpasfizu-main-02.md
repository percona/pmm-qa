# .claude/skills/qa-code-review/SKILL.md — run the linter against the pre-change baseline, not only the new tree

- Added: 2026-09-21
- Applies to: all skills that edit linted workflow, shell or YAML files
- Evidence: Replacing `${{ env.X }}` with `${X}` inside GitHub Actions `run:` blocks made eight previously-invisible SC2086 findings reachable by actionlint, and adding an Ansible `| quote` filter pushed nine lines past yamllint's 200-character limit; both would have turned a green CI lint check red, and both were caught only by running actionlint against the committed version of the file first.
- Proposed change: When a change alters text a linter was previously unable to parse (template expansion removed, line length grown, a new file extension), run the repo's linter on the pre-change version of the same file and compare, rather than reading a clean-looking run of the new tree as "no new findings".
