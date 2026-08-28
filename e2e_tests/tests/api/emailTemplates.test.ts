import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';

const ABSOLUTE_IMAGE_SRC = /<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"/g;
// PMM-15031: the rebranding deleted this file, and the logo vanished from every PMM email.
const REMOVED_LOGO_URL =
  'https://www.percona.com/wp-content/uploads/product-logos/PMM-logo-horizontal-400-dark-text.png';
// alert_notification.html and alert_notification_example.html are excluded on purpose: they are
// legacy-alerting leftovers that were never rebranded and still carry a grafana.com logo.
const BRANDED_TEMPLATES = [
  'invited_to_org',
  'new_user_invite',
  'ng_alert_notification',
  'passwordless_verify_existing_user',
  'passwordless_verify_new_user',
  'reset_password',
  'signup_started',
  'verify_email',
  'welcome_on_signup',
];

for (const templateName of BRANDED_TEMPLATES) {
  pmmTest(
    `PMM-T2285 - ${templateName} email template logo resolves to a real image @alerting`,
    async ({ request }) => {
      const template = await request.get(`graph/public/emails/${templateName}.html`, {
        headers: GrafanaHelper.getAuthHeader(),
      });

      expect(template.status(), `Reading ${templateName}.html`).toBe(200);

      const logoUrls = [...(await template.text()).matchAll(ABSOLUTE_IMAGE_SRC)].map(([, url]) => url);

      expect(logoUrls, `${templateName}.html carries no absolute <img> src`).not.toHaveLength(0);

      const [logoUrl] = logoUrls;

      expect(logoUrl, `${templateName}.html still points at the URL the rebranding removed`).not.toBe(
        REMOVED_LOGO_URL,
      );

      const logo = await request.get(logoUrl);

      expect(logo.status(), `Fetching ${logoUrl}`).toBe(200);
      // docs.percona.com serves a missing asset as its 404 page under HTTP 200, so only the content
      // type tells a published logo apart from the gap a mail client would render.
      expect(logo.headers()['content-type'], `${logoUrl} served a non-image`).toMatch(/^image\//);
    },
  );
}
