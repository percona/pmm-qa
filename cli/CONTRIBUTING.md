# Contributing To PMM CLI Tests

Use this guide when adding or changing CLI tests under `cli/`.

## Adding A Test

1. Create the test under `tests/` with the `*.spec.ts` suffix.
2. Use `test` and `expect` from `@playwright/test`.
3. Reuse helpers from `helpers/` before adding command execution logic directly to a test.
4. Put reusable command flows in `helpers/pmm-admin.ts` or `helpers/cli-helper.ts`.
5. Keep assertions close to the behavior being verified.
6. Add a meaningful `test.describe` tag when the area already uses tags.
7. Run the changed test directly before running a broader suite.

Test template:

```ts
import { expect, test } from "@playwright/test";
import * as cli from "@helpers/cli-helper";

test.describe("Feature CLI tests", { tag: "@tag" }, async () => {
  test("PMM-TXXXX - Verify feature behavior", async ({}) => {
    const output = await cli.exec("pmm-admin <command>");

    await output.assertSuccess();
    expect(output.stdout).toContain("<expected-output>");
  });
});
```

Run the test directly:

```bash
npx playwright test tests/<filename>.spec.ts
```
