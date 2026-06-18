---
description: PMM Login using basic Auth headers
---

**Resolve credentials by context:**
- From `pmm-manual-test`: use user-provided PMM instance URL, `ADMIN_USERNAME=admin`, `ADMIN_PASSWORD=pmm3admin!`
- Standalone: use root `.env` — `PMM_UI_URL`, `ADMIN_USERNAME` (default `admin`), `ADMIN_PASSWORD`

**`<PRECOMPUTED_AUTH>`** = base64 of `ADMIN_USERNAME:ADMIN_PASSWORD` computed outside MCP (no `Buffer`, no `btoa`, no credentials in URL).

```javascript
async (page) => {
  const base = "<PMM_UI_URL>";
  const auth = "<PRECOMPUTED_AUTH>";

  await page.context().setExtraHTTPHeaders({ Authorization: `Basic ${auth}` });
  await page.route("**/api/user/auth-tokens/rotate", (route) =>
    route.fulfill({ body: "{}", contentType: "application/json", status: 200 }),
  );
  await page.route("**/v1/users/me", (route) =>
    route.fulfill({
      body: JSON.stringify({
        alerting_tour_completed: true,
        product_tour_completed: true,
        snoozed_pmm_version: "",
        user_id: 1,
      }),
      contentType: "application/json",
      status: 200,
    }),
  );

  await page.goto(`${base}/pmm-ui/help`);
};
```

Reply `Done`.
