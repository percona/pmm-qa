import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';

// PMM-15031: every Percona-branded Grafana email template renders one shared mjml
// header partial, so the single logo URL in it is a whole-product dependency on a
// host nobody in PMM owns. The rebranding deleted the percona.com product-logo file
// and silently broke the logo in every PMM email at once.
const REMOVED_LOGO_URL =
  'https://www.percona.com/wp-content/uploads/product-logos/PMM-logo-horizontal-400-dark-text.png';
// The templates Grafana ships with the Percona header. alert_notification.html and
// alert_notification_example.html are deliberately absent: they are legacy-alerting
// leftovers that were never rebranded and still carry a grafana.com logo.
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

const headerLogoUrl = (templateName: string, html: string): string => {
  const firstAbsoluteImage = [...html.matchAll(/<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"/g)][0];

  expect(firstAbsoluteImage, `${templateName}.html should carry a header logo <img>`).toBeDefined();

  return firstAbsoluteImage[1];
};

// Tagged @alerting so it runs on the FB job that already boots a plain PMM server —
// ng_alert_notification.html, the email PMM itself sends most, is one of the templates
// asserted here.
pmmTest(
  'PMM-T2285 - Verify the PMM logo in every Grafana email template resolves to a real image @alerting',
  async ({ request }) => {
    const logoUrls = new Set<string>();

    for (const templateName of BRANDED_TEMPLATES) {
      await pmmTest.step(`${templateName}.html points at a logo that still exists`, async () => {
        const response = await request.get(`graph/public/emails/${templateName}.html`, {
          headers: GrafanaHelper.getAuthHeader(),
        });

        expect(
          response.status(),
          `Reading email template ${templateName}.html returned ${response.status()}`,
        ).toBe(200);

        const logoUrl = headerLogoUrl(templateName, await response.text());

        expect(
          logoUrl,
          `${templateName}.html still points at the percona.com product-logo URL removed by the rebranding`,
        ).not.toBe(REMOVED_LOGO_URL);

        logoUrls.add(logoUrl);
      });
    }

    for (const logoUrl of logoUrls) {
      await pmmTest.step(`${logoUrl} serves an image`, async () => {
        const response = await request.get(logoUrl);

        expect(response.status(), `Fetching the email logo returned ${response.status()}`).toBe(200);

        // Not redundant with the status assertion: docs.percona.com answers a missing
        // asset with its 404 *page* under HTTP 200, so only the content type tells a
        // published logo apart from a broken link that a mail client renders as a gap.
        expect(
          response.headers()['content-type'],
          `The email logo URL served "${response.headers()['content-type']}" instead of an image`,
        ).toMatch(/^image\//);
      });
    }
  },
);
