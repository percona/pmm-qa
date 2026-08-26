# Suite map

A finding is only actionable once you can name the workflow that produced it and the directory that holds the
test. Smart Tests knows the suite name and the test path; this maps both back.

## Suite names

Every name is built at record time from the tag being run, so the set grows with the tag matrix rather than
being fixed. The families:

| `--test-suite` pattern | Recorded by | Suite directory | Runner |
| ---------------------- | ----------- | --------------- | ------ |
| `pw-ui-tests-<tag>` | `runner-e2e-tests-playwright.yml:164` | `e2e_tests/` | Playwright |
| `ui-tests-<tags>` | `runner-e2e-tests-codeceptjs.yml:178` | `codeceptjs-e2e/` | CodeceptJS (legacy) |
| `cli-tests-<name>-<tags>` | `runner-integration-cli-tests.yml:148` | `cli/` | Playwright |
| `<installation>-nightly-ui-tests-<tags>` | `runner-e2e-tests-playwright-remote-nightly-tests.yml:150` and `runner-e2e-tests-codeceptjs-remote-nightly-tests.yml:152` | `e2e_tests/` or `codeceptjs-e2e/` | nightly, remote |

How the suffixes are built:

- `<tag>` in `pw-ui-tests-` is `PMM_TEST_FLAG` with `@` removed and `|` replaced by `-`
  (`runner-e2e-tests-playwright.yml:147`) — so `@pmm-ha` records as `pw-ui-tests-pmm-ha`.
- `<tags>` elsewhere is `TAGS_FOR_TESTS` with `|` replaced by `-`.
- `<installation>` is the nightly's `installation_type` input, `docker` unless the matrix passes another.

The two nightly families share a name shape across two runners, so the same
`<installation>-nightly-ui-tests-<tags>` prefix can mean either suite. Resolve it from the test path, not the
suite name.

## Test paths

Playwright records the spec path relative to its own working directory, so a path resolves against the suite
directory rather than the repo root — `tests/helpCenter.test.ts` is `e2e_tests/tests/helpCenter.test.ts`.
Check the path exists before reporting a finding against it:

```bash
for d in e2e_tests codeceptjs-e2e cli; do [ -f "$d/$p" ] && echo "$d/$p"; done
```

A path that resolves in none of the three is either renamed since the session ran (`git log --follow --all --
"*<basename>"` finds it) or deleted. Say which — a finding against a test that no longer exists is noise, and
a rename means the history is split across two paths and both need querying.

CodeceptJS records differently from Playwright, so treat a `codeceptjs-e2e` path as needing the check above
rather than assuming the same shape.
