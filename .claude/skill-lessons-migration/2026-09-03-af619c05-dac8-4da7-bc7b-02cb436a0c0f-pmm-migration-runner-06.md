# .claude/skills/codeceptjs-migration/branch-workflow.md - name the content-neutral way to fix a non-tip commit message on the publish branch

- Added: 2026-09-03
- Applies to: target only
- Evidence: Row 4's publish step had to correct the message of the first of the publish branch's two commits after the final gate had already passed on the tip; `git rebase -i` is unavailable in this environment, and the workflow documents no alternative, so the sequence had to be derived - `git checkout --detach <commit>`, `git commit --amend -F <msgfile>` (which preserves the original author and author date), `git cherry-pick <tip>`, `git branch -f <branch> HEAD`, `git checkout <branch>` - and then proven message-only, since a passing final gate is only valid for the tree it reviewed.
- Proposed change: Add that sequence to the publish section together with its three-command proof - `git diff <old-tip> <new-tip>` empty, `<old>^{tree}` equal to `<new>^{tree}` at both the amended commit and the tip, and the tip's `%B` unchanged - and require the proof before pushing, because an empty `git diff` alone does not show that the intermediate commit's tree also survived.
