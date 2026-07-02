---
description: PMM UI login — pick the path for your runtime (playwright-cli vs Playwright MCP)
---

# Which login path?

| Runtime | When | How |
|---------|------|-----|
| **Cloud Agent / MicroVM** | Cursor automation, manual QA on MicroVM, `playwright-cli` on PATH | [playwright-cli](#playwright-cli-cloud-agent--microvm) below **or** run `qa-integration/scripts/pmm-ui-login.sh <TICKET>` |
| **Local IDE + Playwright MCP** | VS Code / Antigravity with `@playwright/mcp` | [Playwright MCP](#playwright-mcp-local-ide) below |

**Preconditions (both paths)**

- Confirm `PMM_URL` (default MicroVM: `https://127.0.0.1`).
- Confirm current `ADMIN_PASSWORD` (default before mutation: `pmm3admin!`).
- **Do not** assume defaults after password change — recompute Basic token from `admin:<current_password>`.
- Default Basic token before mutation: `admin` / `pmm3admin!` → `YWRtaW46cG1tM2FkbWluIQ==`.

**Never** fill the Grafana login form in the browser. Use programmatic auth only.

---

## playwright-cli (Cloud Agent / MicroVM)

Preferred: one-shot script (session name `pmm-<TICKET>`):

```bash
export PMM_URL='https://127.0.0.1'
export ADMIN_PASSWORD='pmm3admin!'   # must match provision-pmm.sh / pmm-framework.py
qa-integration/scripts/pmm-ui-login.sh PMM-14576
```

Follow-up UI commands reuse the same session:

```bash
playwright-cli -s=pmm-PMM-14576 snapshot
playwright-cli -s=pmm-PMM-14576 click e21
```

Headed by default (screen recordings). Opt out: `PMM_UI_HEADED=0 qa-integration/scripts/pmm-ui-login.sh <TICKET>`.

Manual equivalent (if you cannot run the script):

```bash
export PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS=1
TICKET=PMM-14576
PMM_URL="${PMM_URL:-https://127.0.0.1}"
PASSWORD="${ADMIN_PASSWORD:-pmm3admin!}"
AUTH="$(printf 'admin:%s' "$PASSWORD" | base64 -w0 2>/dev/null || printf 'admin:%s' "$PASSWORD" | base64)"

playwright-cli -s="pmm-${TICKET}" open --headed "$PMM_URL"
playwright-cli -s="pmm-${TICKET}" run-code "async page => {
  const base = page.url().match(/^https?:\\/\\/[^/]+/)[0];
  await page.setExtraHTTPHeaders({ Authorization: 'Basic ${AUTH}' });
  await page.route('**/api/user/auth-tokens/rotate', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/v1/users/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerting_tour_completed: true, product_tour_completed: true, snoozed_pmm_version: '', user_id: 1 }) }));
  await page.route('**/v1/server/updates?force=**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ installed: {}, last_check: new Date().toISOString(), latest: {}, update_available: false }) }));
  const res = await page.request.post(base + '/graph/login', { data: { user: 'admin', password: '${PASSWORD}' } });
  if (res.status() >= 400) throw new Error('Login failed: HTTP ' + res.status() + ' ' + await res.text());
  await page.goto(base + '/pmm-ui/help');
}"
```

Success → reply `Done` and continue UI work in the same `-s=pmm-<TICKET>` session.

---

## Playwright MCP (local IDE)

Use Basic Auth headers via `mcp_playwright_browser_run_code`. Replace password if mutated.

```javascript
async (page) => {
  const base = process.env.PMM_URL || "https://127.0.0.1";
  const password = process.env.ADMIN_PASSWORD || "pmm3admin!";
  const auth = Buffer.from(`admin:${password}`).toString("base64");

  await page.context().setExtraHTTPHeaders({ Authorization: `Basic ${auth}` });

  await page.route("**/api/user/auth-tokens/rotate", async (route) => {
    await route.fulfill({ body: "{}", contentType: "application/json", status: 200 });
  });

  await page.route("**/v1/users/me", async (route) => {
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

  await page.goto(`${base}/pmm-ui/help`);
};
```

MCP server must include `--ignore-https-errors` (see `.agents/README.md`).

Success → reply `Done` and continue with batched MCP browser actions per `mcpRules.md`.
