#!/usr/bin/env node
/**
 * Fast DOM locator check against a prepared local PMM instance.
 * MCP fallback when browser_navigate is unavailable.
 *
 * Usage:
 *   node .cursor/scripts/verify-migration-locator.mjs help-export-logs
 *   node .cursor/scripts/verify-migration-locator.mjs role-link "Export logs" /logs.zip
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const e2eDir = path.join(repoRoot, 'e2e_tests');
const { chromium } = createRequire(path.join(e2eDir, 'package.json'))('playwright');

const pmmUrl = (process.env.PMM_UI_URL ?? 'http://127.0.0.1/').replace(/\/?$/, '/');
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin-password';
const helpPath = `${pmmUrl}pmm-ui/help`;

const presets = {
  'help-export-logs': {
    pageUrl: helpPath,
    role: 'link',
    name: 'Export logs',
    href: '/logs.zip',
  },
};

const parseArgs = () => {
  const [, , presetOrRole, name, href] = process.argv;

  if (!presetOrRole) {
    console.error('usage: verify-migration-locator.mjs <preset|role> [name] [href]');
    console.error('presets:', Object.keys(presets).join(', '));
    process.exit(2);
  }

  if (presets[presetOrRole]) {
    return presets[presetOrRole];
  }

  return {
    pageUrl: helpPath,
    role: presetOrRole,
    name,
    href,
  };
};

const spec = parseArgs();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  extraHTTPHeaders: {
    Authorization: `Basic ${Buffer.from(`admin:${adminPassword}`).toString('base64')}`,
  },
});
const page = await context.newPage();

await page.route('**/api/user/auth-tokens/rotate', (route) =>
  route.fulfill({ body: '{}', contentType: 'application/json', status: 200 }),
);

await page.goto(spec.pageUrl, { waitUntil: 'networkidle', timeout: 60_000 });

const roleLink = page.getByRole(spec.role, { name: spec.name });
const roleCount = await roleLink.count();
const roleHref = roleCount === 1 ? await roleLink.getAttribute('href') : null;
const roleName = roleCount === 1 ? await roleLink.innerText() : null;

let hrefCount = 0;
if (spec.href) {
  hrefCount = await page.locator(`a[href="${spec.href}"]`).count();
}

const result = {
  pageUrl: spec.pageUrl,
  role: spec.role,
  name: spec.name,
  href: spec.href,
  roleCount,
  hrefCount,
  roleHref,
  roleName,
  match: roleCount === 1 && (!spec.href || hrefCount === 1),
};

console.log(JSON.stringify(result, null, 2));
await browser.close();

if (!result.match) {
  process.exit(1);
}
