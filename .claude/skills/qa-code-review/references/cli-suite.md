# `cli/` — pmm-admin CLI tests

Playwright as a runner, no browser. **Conventions do not carry over from `e2e_tests/`** — do not apply that reference here.

| | `cli/` | `e2e_tests/` |
|---|---|---|
| File suffix | `*.spec.ts` | `*.test.ts` |
| Entry point | raw `test` / `expect` from `@playwright/test` | `pmmTest` from `@fixtures/pmmTest` |
| Tags | `test.describe('…', { tag: '@tag' }, …)` | in the test title |
| Reuse | `helpers/cli-helper.ts`, `helpers/pmm-admin.ts` | page objects |
| Lint | `npm run lint` = `eslint . && tsc --noEmit` | no script yet |
| tsconfig | `include: ["./"]` — everything type-checked | `tests/**` + config only |

Details in [cli/CONTRIBUTING.md](../../../../cli/CONTRIBUTING.md).

## Findings

- Command execution logic inline in a spec belongs in `helpers/cli-helper.ts` or `helpers/pmm-admin.ts`. 🟡
- A helper with one caller belongs in its caller — including "even though it's repeatable". 🟡
- Cleanup in `afterEach`, not `try/finally`. 🟡
- Assertions close to the behaviour, not batched at the end.
- `PMM-Txxxx` in every test title — same rule as the UI suite.
- An assertion removed without a stated reason is 🔴: say which other assertion covers it.
- A retry budget must fit inside the enclosing timeout. `beforeAll` inherits the test timeout, so a `toPass` loop longer than that gets cut mid-retry — raise it with `test.setTimeout()` and show the arithmetic.
- `++` in test code: prefer an explicit expression.
- `cli/` already carries `@types/adm-zip` and `helpers/zip-helper.ts`; `e2e_tests/` has its own `helpers/archive.helper.ts`. A third copy is 🟡.
