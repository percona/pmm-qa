# Reading a failure, and fixing it here

## From the log

This CLI has no command that returns failure output, so the log comes from the run that produced it: the
GitHub Actions job log for the session's workflow run (GitHub MCP `get_job_logs`, which Routine sessions can
use where `gh` is absent), and the `logs.zip` each runner uploads via `launchable record attachment`. Take the
session id from `stats test-sessions` back to its run before reading anything into a failure.

The distinction that matters is whether the test failed for a reason inside the test or outside it:

| In the log | Cause | Whose |
| ---------- | ----- | ----- |
| Exit 142, `SIGTERM`, runner lost, job timeout | Infrastructure — the runner died | Not the test's. Report it against the workflow, not the spec. |
| Assertion mismatch on a value that used to match | Product regression, or a UI the test tracked too literally | Read the diff in the spike window before blaming either. |
| Timeout waiting for a locator, passes on retry | The test raced the app | The test's, and the common case. |
| `Cannot find module`, import error, version mismatch | Dependency or config drift | Usually a Dependabot bump or a lockfile change in the window. |
| Passes alone, fails in a full run | Shared state — leftover services, a shared PMM instance, worker collision | The test's setup or teardown. |

Compare attempts within one session before comparing across sessions: a test that fails and then passes on the
same commit is racing something, while one that fails on every attempt of a commit and passes on the next
commit is tracking a real change.

## What the fix looks like in this repo

The Playwright suite pins `@playwright/test ^1.62.1` and enforces `playwright/no-wait-for-timeout`, so a fixed
sleep is already a lint exception with a written reason. The recurring shapes:

- **A sleep standing in for a wait.** `e2e_tests/api/grafana.api.ts:62` carries
  `eslint-disable-next-line playwright/no-wait-for-timeout -- TODO: Rework with proper poll or waitFor` — a
  disable whose reason is a TODO is an unfinished fix, and the honest version is `expect.poll` or a
  `waitForResponse` on the call actually being waited for. Filling in a real reason is also a valid outcome
  where the wait genuinely cannot be observed.
- **A magic number instead of the enum.** `e2e_tests/tests/qan/rta/overview.test.ts:112` waits `500` directly
  while the rest of the file uses `Timeouts` from `e2e_tests/helpers/timeouts.ts`. Add the constant rather than
  raising the literal.
- **A wait that belongs to a fixture, not a test.** Waits repeated across specs belong in `pmmTest`
  (`e2e_tests/fixtures/pmmTest.ts`) or the page object, so one fix covers every caller. Reviewers ask for this
  move often enough that it is worth checking before adding a local wait.
- **A raised timeout.** Raising a timeout converts a fast failure into a slow one and moves the test toward the
  🔵 bucket. It is a fix only when the operation is genuinely slow and you can say what it is waiting for.

## Before proposing it as fixed

A stabilisation is a claim about behaviour over many runs, and one green run does not support it. What does:
the failure reproduced first and then stopped under the same conditions, or the log evidence names a cause the
change actually removes. Where you have neither, the finding is still worth reporting — as a finding, with what
is missing named, rather than as a fix.
