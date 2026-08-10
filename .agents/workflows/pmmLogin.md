---
description: PMM Login using basic Auth headers
---

- NEVER use UI login form.
- DO NOT pass plain credentials in the URL string.
- Use Basic Auth header via `mcp__playwright__browser_run_code_unsafe` — Playwright MCP only, per `mcpRules.md`.

## Precondition — confirm URL and current password before every login

- Confirm `PMM_URL` and the **current** admin password first. **Do not reuse a default
  after any mutation** — a custom `--admin-password` flag on `setup.ts`, or a password
  changed via PMM Settings, invalidates the default token below.
- Defaults hold **only before** such a mutation:
  - Local provisioning (`setup.ts` default): `https://127.0.0.1`, `admin:admin` →
    `Basic YWRtaW46YWRtaW4=`
  - Old Jenkins-flow default: `admin:pmm3admin!` → `Basic YWRtaW46cG1tM2FkbWluIQ==`
- Always **recompute** the Basic token from `admin:<current password>` before logging in —
  never reuse a token cached from an earlier session.

## Login script (run via `mcp__playwright__browser_run_code_unsafe`)

```javascript
async (page) => {
  const base = "https://127.0.0.1";
  const auth = "YWRtaW46YWRtaW4="; // admin:admin — recompute if password differs

  await page.context().setExtraHTTPHeaders({ Authorization: `Basic ${auth}` });

  await page.route("**/api/user/auth-tokens/rotate", async (route) => {
    await route.fulfill({
      body: "{}",
      contentType: "application/json",
      status: 200,
    });
  });

  await page.route("**/v1/users/me", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      body: JSON.stringify({
        alerting_tour_completed: true,
        product_tour_completed: true,
        snoozed_pmm_version: "",
        user_id: 1,
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.route("**/v1/server/updates?force=**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        installed: {},
        last_check: new Date().toISOString(),
        latest: {},
        update_available: false,
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto(`${base}/pmm-ui/help`, { waitUntil: "domcontentloaded" });
};
```

- Reply `Done` immediately after logging in. NO extra info.
