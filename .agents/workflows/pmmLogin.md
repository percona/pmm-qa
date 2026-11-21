---
description: PMM Login using basic Auth headers
---

- NEVER use UI login form.
- Use Basic Auth header via `mcp_playwright_browser_run_code`.
- DO NOT pass plain credentials in the URL string.

```javascript
async (page) => {
  const base = "https://127.0.0.1";
  const auth = Buffer.from("admin:admin").toString("base64");

  await page.context().setExtraHTTPHeaders({ Authorization: `Basic ${auth}` });

  await page.route("**/api/user/auth-tokens/rotate", async (route) => {
    await route.fulfill({
      body: "{}",
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto(`${base}/pmm-ui/help`);
};
```

- Reply `Done` immediately after logging in. NO extra info.
