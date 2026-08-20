---
description: PMM Login using a precomputed Basic Auth header
---

- NEVER use UI login form.
- Use the precomputed Basic Auth header via `mcp_playwright_browser_run_code`.
- DO NOT pass plain credentials in the URL string.
- Set `base` and `authorization` for the prepared environment. The literals below are local defaults (`admin:admin`), not fixed credentials.

```javascript
async (page) => {
  const base = "https://127.0.0.1/".replace(/\/+$/, "");
  const authorization = "Basic YWRtaW46YWRtaW4=";

  await page.context().setExtraHTTPHeaders({ Authorization: authorization });

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

- For a standalone login request, reply `Done` immediately after logging in. When another workflow invokes these steps, continue that workflow after login.
