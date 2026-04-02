---
description: PMM Login using basic Auth headers
---

- NEVER use the UI login form. Use Basic Auth header only.
- In `mcp_playwright_browser_run_code`, do not use `Buffer` or credentials in the URL.
- Use a precomputed Basic Auth token instead.
- Use `mcp_playwright_browser_run_code` to login:
  ```js
  async (page) => {
    const base = 'https://127.0.0.1';
    const auth = Buffer.from(admin:admin).toString('base64');
   
    await page.context().setExtraHTTPHeaders({
      Authorization: 'Basic ${auth}',
    });

    await page.route('**/api/user/auth-tokens/rotate', async (route) => {
      await route.fulfill({ 
        body: '{}', 
        contentType: 'application/json', 
        status: 200
      });
    });
    await page.goto(`$(base)/pmm-ui/help`);
  };
  ```
- Once loggedin, Just say `Done`.