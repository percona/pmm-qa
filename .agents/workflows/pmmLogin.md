---
description: PMM Login
---

Use `GrafanaHelper.authorize` flow, then open Help. Tour completed; updates unavailable.

```javascript
async (page) => {
  const base = "https://127.0.0.1";
  const user = "admin";
  const password = "admin";
  const auth = "YWRtaW46YWRtaW4=";

  await page.context().setExtraHTTPHeaders({ Authorization: `Basic ${auth}` });

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

  await page.route("**/v1/server/updates?force=**", (route) =>
    route.fulfill({
      body: JSON.stringify({
        installed: {},
        last_check: new Date().toISOString(),
        latest: {},
        update_available: false,
      }),
      contentType: "application/json",
      status: 200,
    }),
  );

  await page.request.post(`${base}/graph/login`, { data: { user, password } });
  await page.goto(`${base}/pmm-ui/help`, { waitUntil: "domcontentloaded" });
}
```

Reply `Done`.
