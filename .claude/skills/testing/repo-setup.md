# Repo Setup — Layout, Clone, Update

## Local repo layout

PMM repos are expected as **siblings** under one parent directory (repos root). This skill ships in **pmm-qa**; resolve paths from the pmm-qa clone.

| Repo | Directory (under repos root) | Remote |
|------|------------------------------|--------|
| pmm-qa | `pmm-qa` | `percona/pmm-qa` |
| pmm | `pmm` | `percona/pmm` |
| grafana | `grafana` | `percona/grafana` |
| jenkins-pipelines | `jenkins-pipelines` | `Percona-Lab/jenkins-pipelines` |

**pmm-submodules** — read PR comments and checks via `gh` only, never clone.

A PR can touch code outside this table (e.g. a shared component library in its own repo). Treat any file path from a linked PR's `files` list that isn't under one of these repos as **not locally inspectable** — verify its behavior empirically through the browser/UI instead of reading its source, and say so explicitly when writing test instructions.

## Resolve repos root and paths

**Repos root** = parent directory of the `pmm-qa` git root.

```powershell
$pmmQaRoot = git -C "<path-to-pmm-qa>" rev-parse --show-toplevel
$ReposRoot = (Get-Item $pmmQaRoot).Parent.FullName
```

```bash
PMM_QA_ROOT="$(git -C pmm-qa rev-parse --show-toplevel)"
REPOS_ROOT="$(dirname "$PMM_QA_ROOT")"
```

| Variable | Example path |
|----------|----------------|
| `$ReposRoot` / `$REPOS_ROOT` | `~/vscodeProjects/PMM` |
| pmm | `$ReposRoot/pmm` |
| grafana | `$ReposRoot/grafana` |
| jenkins-pipelines | `$ReposRoot/jenkins-pipelines` |
| pmm-qa | `$ReposRoot/pmm-qa` |

## Clone if missing

If a sibling repo directory does not exist, clone it into **repos root**:

```powershell
$ReposRoot = (Get-Item (git rev-parse --show-toplevel)).Parent.FullName
$repos = @{
  pmm = "https://github.com/percona/pmm.git"
  grafana = "https://github.com/percona/grafana.git"
  "jenkins-pipelines" = "https://github.com/Percona-Lab/jenkins-pipelines.git"
}
foreach ($name in $repos.Keys) {
  $path = Join-Path $ReposRoot $name
  if (-not (Test-Path $path)) { git clone $repos[$name] $path }
}
```

```bash
REPOS_ROOT="$(dirname "$(git rev-parse --show-toplevel)")"
[ -d "$REPOS_ROOT/pmm" ] || git clone https://github.com/percona/pmm.git "$REPOS_ROOT/pmm"
[ -d "$REPOS_ROOT/grafana" ] || git clone https://github.com/percona/grafana.git "$REPOS_ROOT/grafana"
[ -d "$REPOS_ROOT/jenkins-pipelines" ] || git clone https://github.com/Percona-Lab/jenkins-pipelines.git "$REPOS_ROOT/jenkins-pipelines"
```

## Update existing repos — check branch state first

**Do not assume a sibling repo's working copy is on `main`.** It may be sitting on a stale feature branch from unrelated work, possibly with a deleted (`[gone]`) remote-tracking branch. A blind `git pull` there either fails or silently does nothing useful.

For each repo that exists, before pulling:

```bash
git -C "<repo-path>" status -sb
```

- If the branch line shows `## main...origin/main` (or equivalent tracking branch) with no `[gone]` marker → safe to `git -C "<repo-path>" fetch origin && git -C "<repo-path>" pull --ff-only`.
- If it shows any other branch, or `[gone]`, or uncommitted changes → **do not pull on that branch.** Either:
  - `git -C "<repo-path>" fetch origin` only (enough to `gh pr diff`/inspect via API without touching the working tree), or
  - ask the user before switching branches, since the existing checkout may be their in-progress work.

Note: each tool call starts in its configured working directory; directory changes do not persist across calls. Use `git -C "<repo-path>" ...` for Git commands. For commands without a directory option, run `cd "<repo-path>" && <command>` within the same tool call.
