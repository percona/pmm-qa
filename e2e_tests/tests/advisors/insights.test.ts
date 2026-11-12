import AdvisorsApi from '@api/advisors.api';
import MailpitApi from '@api/mailpit.api';
import pmmTest from '@fixtures/pmmTest';
import { AdvisorCheckResultStatus, AdvisorInsight } from '@interfaces/advisors';
import AdvisorInsightsPage from '@pages/advisors/advisorInsights.page';
import { expect } from '@playwright/test';

pmmTest.describe('Advisor insights', () => {
  const createdChecks: string[] = [];
  const createdNodes: string[] = [];

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api }) => {
    for (const name of createdChecks.splice(0)) await api.advisorsApi.deleteCheck(name);
    for (const nodeId of createdNodes.splice(0)) await api.inventoryApi.deleteNode(nodeId, true);
  });

  pmmTest(
    'PMM-T2571 - Verify the insights a run produced and their details @advisors',
    async ({ advisorInsightsPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const run = await api.advisorsApi.runChecksAndWait([check.name]);

      expect(run.findings_count, 'No MySQL service is monitored').toBeGreaterThan(0);

      const [insight] = await api.advisorsApi.listInsights({ run_id: run.id });

      await page.goto(advisorInsightsPage.runUrl(run.id));

      await pmmTest.step('Verify the insights of the run', async () => {
        await expect(advisorInsightsPage.elements.title).toBeVisible();
        await expect(advisorInsightsPage.runIdFilter.inputs.runId).toHaveValue(run.id);
        await expect(advisorInsightsPage.elements.rows).toHaveCount(run.findings_count);
        await expect(advisorInsightsPage.builders.row(insight.id)).toContainText(insight.summary);
        await expect(advisorInsightsPage.builders.row(insight.id)).toContainText(insight.service_name);
        await expect(advisorInsightsPage.builders.row(insight.id)).toContainText('Warning');
        await expect(advisorInsightsPage.builders.row(insight.id)).toContainText('Failed');
      });

      await pmmTest.step('Open the details of an insight', async () => {
        await advisorInsightsPage.builders.row(insight.id).dblclick();
        await expect(advisorInsightsPage.elements.detailsPane).toBeVisible();
        await expect(advisorInsightsPage.builders.detailsField('check-name')).toContainText(check.name);
        await expect(advisorInsightsPage.builders.detailsField('run-id')).toContainText(run.id);
        await expect(advisorInsightsPage.builders.detailsField('service')).toContainText(
          insight.service_name,
        );
        await advisorInsightsPage.buttons.closeDetails.click();
        await expect(advisorInsightsPage.elements.detailsPane).toBeHidden();
      });
    },
  );

  pmmTest(
    'PMM-T2572 - Verify filtering insights by run from the actions menu @advisors',
    async ({ advisorInsightsPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const run = await api.advisorsApi.runChecksAndWait([check.name]);

      expect(run.findings_count, 'No MySQL service is monitored').toBeGreaterThan(0);

      const [insight] = await api.advisorsApi.listInsights({ run_id: run.id });

      await page.goto(advisorInsightsPage.url);

      await pmmTest.step('Verify the filters toolbar', async () => {
        for (const filter of ['serviceName', 'nodeName', 'category', 'severity', 'status'] as const) {
          await expect(advisorInsightsPage.builders.filter(filter)).toBeVisible();
        }

        await expect(advisorInsightsPage.buttons.emailInsights).toBeVisible();
      });

      await pmmTest.step('Filter by the run ID of an insight', async () => {
        await advisorInsightsPage.builders.actionsButton(insight.id).click();
        await advisorInsightsPage.buttons.filterByRunId.click();
        await expect(page).toHaveURL(new RegExp(`runId=${run.id}`));
        await expect(advisorInsightsPage.elements.rows).toHaveCount(run.findings_count);
      });

      await pmmTest.step('Clearing filters drops the run ID', async () => {
        await advisorInsightsPage.buttons.clearFilters.click();
        await expect(advisorInsightsPage.runIdFilter.inputs.runId).toHaveValue('');
        await expect(page).not.toHaveURL(/runId=/);
      });
    },
  );

  pmmTest(
    'PMM-T2588 - Verify the OK, Failed and Error status chips and the Status filter @advisors',
    async ({ advisorInsightsPage, api, page }) => {
      await api.advisorsApi.getMysqlService();

      const error = await api.advisorsApi.createCustomCheck({ script: api.advisorsApi.erroringCheckScript });

      createdChecks.push(error.name);

      const failed = await api.advisorsApi.createCustomCheck();

      createdChecks.push(failed.name);

      const ok = await api.advisorsApi.createCustomCheck({ script: api.advisorsApi.passingCheckScript });

      createdChecks.push(ok.name);

      const checks = { error, failed, ok };
      const run = await api.advisorsApi.runChecksAndWait(Object.values(checks).map(({ name }) => name));
      const insights = await api.advisorsApi.listInsights({ run_id: run.id });
      const insightsOf = (checkName: string) => insights.filter(({ check_name }) => check_name === checkName);
      const statuses = [
        { check: checks.ok, label: 'OK', status: AdvisorCheckResultStatus.ok },
        { check: checks.failed, label: 'Failed', status: AdvisorCheckResultStatus.failed },
        { check: checks.error, label: 'Error', status: AdvisorCheckResultStatus.error },
      ] as const;

      await page.goto(advisorInsightsPage.runUrl(run.id));

      await pmmTest.step('Each insight carries the chip of its status', async () => {
        await expect(advisorInsightsPage.elements.rows).toHaveCount(insights.length);

        for (const { check, label } of statuses) {
          for (const { id } of insightsOf(check.name)) {
            await expect(advisorInsightsPage.builders.row(id)).toContainText(label);
          }
        }
      });

      for (const { check, label, status } of statuses) {
        await pmmTest.step(`The Status filter narrows to ${label} insights`, async () => {
          const expected = insightsOf(check.name);

          await advisorInsightsPage.selectFilter('status', label);
          await expect(page).toHaveURL(new RegExp(`status=${status}`));
          await expect(advisorInsightsPage.elements.rows).toHaveCount(expected.length);
          await expect(advisorInsightsPage.builders.row(expected[0].id)).toBeVisible();
        });
      }

      await pmmTest.step('The Error insight explains the failure', async () => {
        await advisorInsightsPage.builders.row(insightsOf(checks.error.name)[0].id).dblclick();
        await expect(advisorInsightsPage.builders.detailsField('outcome')).toContainText('QA failure');
      });
    },
  );

  pmmTest(
    'PMM-T2589 - Verify insight filters, Filter by name and restoring filters from the menu @advisors',
    async ({ advisorInsightsPage, api, leftNavigation, page }) => {
      const service = await api.advisorsApi.getMysqlService();
      const failing = await api.advisorsApi.createCustomCheck();
      const passing = await api.advisorsApi.createCustomCheck({
        category: 'QA passing',
        script: api.advisorsApi.passingCheckScript,
      });

      createdChecks.push(failing.name, passing.name);

      const run = await api.advisorsApi.runChecksAndWait([failing.name, passing.name]);
      const insights = await api.advisorsApi.listInsights({ run_id: run.id });
      const failingCount = insights.filter(({ check_name }) => check_name === failing.name).length;
      const [nodeName] = insights
        .filter(({ service_id }) => service_id === service.service_id)
        .map(({ node_name }) => node_name);
      const scoped = insights.filter(
        ({ node_name, service_id }) => service_id === service.service_id && node_name === nodeName,
      );
      const scopedFailingCount = scoped.filter(({ check_name }) => check_name === failing.name).length;

      await page.goto(advisorInsightsPage.runUrl(run.id));

      await pmmTest.step('Service and Node options come from the insights history', async () => {
        await advisorInsightsPage.selectFilter('serviceName', service.service_name);
        await advisorInsightsPage.selectFilter('nodeName', nodeName);
        await expect(advisorInsightsPage.elements.rows).toHaveCount(scoped.length);
      });

      await pmmTest.step('Category, Severity and Status narrow the rows together', async () => {
        await advisorInsightsPage.selectFilter('category', failing.category);
        await expect(advisorInsightsPage.elements.rows).toHaveCount(scopedFailingCount);
        await advisorInsightsPage.selectFilter('severity', 'Warning');
        await advisorInsightsPage.selectFilter('status', 'Failed');
        await expect(advisorInsightsPage.elements.rows).toHaveCount(scopedFailingCount);

        for (const param of ['service=', 'node=', 'category=', 'severity=SEVERITY_WARNING', 'status=']) {
          await expect(page).toHaveURL(new RegExp(param));
        }

        await advisorInsightsPage.selectFilter('category', passing.category);
        await expect(advisorInsightsPage.elements.noData).toBeVisible();
      });

      await pmmTest.step('Filter by name keeps only the check of a row', async () => {
        await advisorInsightsPage.buttons.clearFilters.click();
        // The page empties the field after clearing, which overwrites anything typed before then.
        await expect(advisorInsightsPage.runIdFilter.inputs.runId).toHaveValue('');
        await advisorInsightsPage.runIdFilter.apply(run.id);
        await expect(advisorInsightsPage.elements.rows).toHaveCount(insights.length);

        const [insight] = insights.filter(({ check_name }) => check_name === failing.name);

        await advisorInsightsPage.builders.actionsButton(insight.id).click();
        await advisorInsightsPage.buttons.filterByCheckName.click();
        await expect(page).toHaveURL(new RegExp(`check=${failing.name}`));
        await expect(advisorInsightsPage.elements.rows).toHaveCount(failingCount);
      });

      await pmmTest.step('The menu brings the filters back after leaving the page', async () => {
        await leftNavigation.selectMenuItem('advisors.catalog');
        await expect(page).toHaveURL(/\/pmm-ui\/advisors$/);
        await leftNavigation.selectMenuItem('advisors.insights');
        await expect(page).toHaveURL(new RegExp(`check=${failing.name}`));
        await expect(page).toHaveURL(new RegExp(`runId=${run.id}`));
        await expect(advisorInsightsPage.elements.rows).toHaveCount(failingCount);
      });
    },
  );

  pmmTest(
    'PMM-T2590 - Verify copying an insight as text and as a URL that opens its details @advisors',
    async ({ advisorInsightsPage, api, context, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const run = await api.advisorsApi.runChecksAndWait([check.name]);
      const [insight] = await api.advisorsApi.listInsights({ run_id: run.id });

      expect(insight, 'No MySQL service is monitored').toBeDefined();
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('status', 'Failed');

      await pmmTest.step('Copy as text describes the insight', async () => {
        await advisorInsightsPage.builders.actionsButton(insight.id).click();
        await advisorInsightsPage.buttons.copyAsText.click();
        await expect(advisorInsightsPage.messages.insightCopied).toBeVisible();

        const text = await page.evaluate(() => navigator.clipboard.readText());

        for (const line of advisorInsightsPage.copiedTextLines(insight, check, run.id)) {
          expect(text).toContain(line);
        }
      });

      const url = await pmmTest.step('Copy URL keeps the filters and names the insight', async () => {
        await advisorInsightsPage.builders.actionsButton(insight.id).click();
        await advisorInsightsPage.buttons.copyUrl.click();
        await expect(advisorInsightsPage.messages.insightUrlCopied).toBeVisible();

        const copied = await page.evaluate(() => navigator.clipboard.readText());

        for (const param of [
          `runId=${run.id}`,
          `status=${AdvisorCheckResultStatus.failed}`,
          `insight=${insight.id}`,
        ]) {
          expect(copied).toContain(param);
        }

        return copied;
      });

      await pmmTest.step('The copied URL opens the insight maximized with the same filters', async () => {
        const sharedPage = await context.newPage();
        const shared = new AdvisorInsightsPage(sharedPage);

        await sharedPage.goto(url);
        await expect(shared.elements.detailsPane).toBeVisible();
        await expect(shared.buttons.maximizeDetails).toHaveAttribute('aria-label', 'Minimize');
        await expect(shared.builders.detailsField('summary')).toContainText(insight.summary);
        await shared.buttons.closeDetails.click();
        await expect(shared.runIdFilter.inputs.runId).toHaveValue(run.id);
        await expect(shared.builders.filter('status')).toHaveText('Failed');
        await sharedPage.close();
      });
    },
  );

  pmmTest(
    'PMM-T2591 - Verify re-running a check for the service of an insight @advisors',
    async ({ advisorInsightsPage, api, context, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const run = await api.advisorsApi.runChecksAndWait([check.name]);
      const [insight] = await api.advisorsApi.listInsights({ run_id: run.id });

      expect(insight, 'No MySQL service is monitored').toBeDefined();
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.builders.actionsButton(insight.id).click();
      await advisorInsightsPage.buttons.rerunNow.click();
      await expect(
        advisorInsightsPage.builders.rerunStarted(check.summary, insight.service_name),
      ).toBeVisible();

      const rerun = await api.advisorsApi.waitForRun(
        await page.evaluate(() => navigator.clipboard.readText()),
      );

      expect(rerun).toMatchObject({
        check_names: [check.name],
        planned_checks_count: 1,
        planned_services_count: 1,
        service_ids: [insight.service_id],
      });
    },
  );

  pmmTest(
    'PMM-T2592 - Verify disabling and enabling a check for the service of an insight @advisors',
    async ({ advisorInsightsPage, advisorsCatalogPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const run = await api.advisorsApi.runChecksAndWait([check.name]);
      const [insight] = await api.advisorsApi.listInsights({ run_id: run.id });

      expect(insight, 'No MySQL service is monitored').toBeDefined();

      const row = advisorInsightsPage.builders.row(insight.id);
      const toggle = advisorInsightsPage.buttons.disableCheckForService;

      await page.goto(advisorInsightsPage.runUrl(run.id));

      await pmmTest.step('Disable the check for the service', async () => {
        await advisorInsightsPage.builders.actionsButton(insight.id).click();
        await expect(toggle).toHaveText('Disable check for service');
        await toggle.click();
        await expect(
          advisorInsightsPage.builders.checkDisabledForService(check.summary, insight.service_name),
        ).toBeVisible();
        await expect
          .poll(async () => (await api.advisorsApi.findCheck(check.name))?.disabled_service_ids)
          .toEqual([insight.service_id]);
        await expect(row).toHaveAttribute('data-check-disabled', 'true');
      });

      await pmmTest.step('The menu offers to enable it and no longer re-runs it', async () => {
        await advisorInsightsPage.builders.actionsButton(insight.id).click();
        await expect(toggle).toHaveText('Enable check for service');
        await expect(advisorInsightsPage.buttons.rerunNow).toBeDisabled();
        await page.keyboard.press('Escape');
      });

      await pmmTest.step('The Catalog counts the disabled service', async () => {
        await page.goto(advisorsCatalogPage.url);
        await advisorsCatalogPage.inputs.search.fill(check.summary);
        await expect(advisorsCatalogPage.builders.servicesBadge(check.name)).toContainText('1');
      });

      await pmmTest.step('Enable the check for the service again', async () => {
        await page.goto(advisorInsightsPage.runUrl(run.id));
        await advisorInsightsPage.builders.actionsButton(insight.id).click();
        await toggle.click();
        await expect(
          advisorInsightsPage.builders.checkEnabledForService(check.summary, insight.service_name),
        ).toBeVisible();
        await expect
          .poll(async () => (await api.advisorsApi.findCheck(check.name))?.disabled_service_ids ?? [])
          .toEqual([]);
        await expect(row).not.toHaveAttribute('data-check-disabled');
      });
    },
  );

  pmmTest(
    'PMM-T2593 - Verify the Email insights dialog @advisors',
    async ({ advisorInsightsPage, api, page }) => {
      await api.advisorsApi.getMysqlService();

      // 201 findings per service: one error, the rest warnings, so one filter goes over the email limit and another under it.
      const check = await api.advisorsApi.createCustomCheck({
        script: AdvisorsApi.findingsScript(201, 'error'),
      });
      const { emailDialog } = advisorInsightsPage;

      createdChecks.push(check.name);

      const run = await api.advisorsApi.runChecksAndWait([check.name]);
      const settingsBefore = (await api.settingsApi.getSettings()).settings;

      await pmmTest.step('Without filters the dialog emails every insight', async () => {
        await page.goto(advisorInsightsPage.url);
        await advisorInsightsPage.buttons.emailInsights.click();
        await expect(emailDialog.messages.unfiltered).toBeVisible();
        await emailDialog.buttons.cancel.click();
        await expect(emailDialog.elements.dialog).toBeHidden();
      });

      await pmmTest.step('More than 200 matching insights cannot be sent', async () => {
        await page.goto(advisorInsightsPage.runUrl(run.id));
        await advisorInsightsPage.buttons.emailInsights.click();
        await expect(emailDialog.builders.filtered(run.findings_count)).toBeVisible();
        await expect(emailDialog.builders.tooMany(run.findings_count)).toBeVisible();
        await emailDialog.inputs.addresses.fill('qa@example.com');
        await expect(emailDialog.buttons.send).toBeDisabled();
        await emailDialog.buttons.cancel.click();
      });

      await pmmTest.step('Recipients must be valid addresses, at most 20', async () => {
        await advisorInsightsPage.selectFilter('severity', 'Error');
        await advisorInsightsPage.buttons.emailInsights.click();
        await expect(emailDialog.builders.filtered(run.services_count)).toBeVisible();
        await expect(emailDialog.elements.tooMany).toBeHidden();
        await emailDialog.inputs.addresses.fill('qa@example.com');
        await expect(emailDialog.buttons.send).toBeEnabled();

        for (const [addresses, error] of [
          ['', emailDialog.messages.addressRequired],
          ['qa@example.com, not-an-email', emailDialog.builders.addressInvalid('not-an-email')],
          [
            Array.from({ length: 21 }, (_, i) => `qa${i}@example.com`).join(' '),
            emailDialog.builders.tooManyAddresses(21),
          ],
        ] as const) {
          await emailDialog.inputs.addresses.fill(addresses);
          await expect(error).toBeVisible();
          await expect(emailDialog.buttons.send).toBeDisabled();
        }
      });

      await pmmTest.step(
        'Send emails the matching insights with their filters and status counts',
        async () => {
          const recipient = MailpitApi.recipient('insights');

          await emailDialog.inputs.addresses.fill(recipient);
          await emailDialog.buttons.send.click();
          await expect(advisorInsightsPage.builders.insightsEmailed(run.services_count, 1)).toBeVisible();
          await expect(emailDialog.elements.dialog).toBeHidden();

          const email = await api.mailpitApi.waitForMessageTo(recipient);

          expect(email.Subject).toEqual(
            `PMM Advisor Insights: ${run.services_count} insight(s) shared with you`,
          );

          for (const text of [
            `Filters:\n  Run ID: ${run.id}\n  Severity: Error\n`,
            `Insights by status:\n  Failed: ${run.services_count}\n  Error: 0\n  OK: 0\n`,
            `Advisor Insights (${run.services_count}):`,
            'The Advisor Check "Finding 0"',
          ]) {
            expect(email.Text).toContain(text);
          }
        },
      );

      await pmmTest.step('Emailing insights leaves the notification settings alone', async () => {
        expect((await api.settingsApi.getSettings()).settings).toEqual(settingsBefore);
      });
    },
  );

  pmmTest(
    'PMM-T2608 - Verify insights link to the documentation page of their check @advisors',
    async ({ advisorInsightsPage, api, page }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const run = await api.advisorsApi.runChecksAndWait();
      const insights = await api.advisorsApi.listInsights({ page_size: '500', run_id: run.id });
      const failedBuiltins = insights.filter(
        ({ check_name, status }) =>
          status === AdvisorCheckResultStatus.failed && !check_name.startsWith('custom_'),
      );
      const custom = insights.find(({ check_name }) => check_name === check.name) as AdvisorInsight;

      await pmmTest.step('Every failed built-in check links to its own documentation page', async () => {
        const checksByUrl = new Map<string, Set<string>>();

        expect(failedBuiltins.length, 'No built-in check failed on the monitored services').toBeGreaterThan(
          0,
        );

        for (const { check_name, read_more_url } of failedBuiltins) {
          expect(read_more_url, check_name).toMatch(
            /^https:\/\/docs\.percona\.com\/percona-monitoring-and-management\/3\/advisors\/checks\/[\w-]+\.html$/,
          );
          checksByUrl.set(read_more_url, (checksByUrl.get(read_more_url) ?? new Set()).add(check_name));
        }

        for (const [url, names] of checksByUrl) {
          expect([...names], url).toHaveLength(1);
          // A missing page answers 301 to the docs 404 page, which answers 200.
          expect((await page.request.get(url, { maxRedirects: 0 })).status(), url).toEqual(200);
        }
      });

      await pmmTest.step('The table marks a documented insight and its pane links to the page', async () => {
        const [documented] = failedBuiltins;

        await page.goto(`${advisorInsightsPage.runUrl(run.id)}&check=${documented.check_name}`);
        await expect(advisorInsightsPage.builders.readMoreIndicator(documented.id)).toBeVisible();
        await advisorInsightsPage.builders.row(documented.id).dblclick();
        await expect(advisorInsightsPage.elements.readMoreLink).toHaveAttribute(
          'href',
          documented.read_more_url,
        );
      });

      await pmmTest.step('An insight without a documentation link is not marked', async () => {
        await page.goto(`${advisorInsightsPage.runUrl(run.id)}&check=${check.name}`);
        await expect(advisorInsightsPage.builders.row(custom.id)).toBeVisible();
        await expect(advisorInsightsPage.builders.readMoreIndicator(custom.id)).toBeHidden();
      });
    },
  );

  pmmTest(
    'PMM-T2609 - Verify an insight keeps the topology and labels of its service @advisors',
    async ({ advisorInsightsPage, api, page }) => {
      const name = `qa-topology-${Date.now()}`;
      const topology = {
        cluster: 'qa-cluster',
        environment: 'qa-environment',
        replication_set: 'qa-replication-set',
      };
      const service = await api.managementApi.addUnreachableMysql(
        name,
        { ...topology, custom_labels: { qa_label: 'qa-value' } },
        { az: 'qa-az', region: 'qa-region' },
      );

      createdNodes.push(service.node_id);

      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);

      const run = await api.advisorsApi.runChecksAndWait([check.name]);
      const insight = (await api.advisorsApi.listInsights({ run_id: run.id })).find(
        ({ service_id }) => service_id === service.service_id,
      ) as AdvisorInsight;

      await pmmTest.step('The API returns the topology and labels of the service', async () => {
        expect(insight).toMatchObject({
          ...topology,
          az: 'qa-az',
          node_name: name,
          region: 'qa-region',
          service_name: name,
        });
        expect(insight.labels).toMatchObject({ ...topology, qa_label: 'qa-value' });
      });

      await pmmTest.step('The details pane shows them', async () => {
        await page.goto(`${advisorInsightsPage.runUrl(run.id)}&insight=${insight.id}`);
        await expect(advisorInsightsPage.elements.detailsPane).toBeVisible();

        for (const [field, value] of [
          ['node', name],
          ['environment', topology.environment],
          ['cluster', topology.cluster],
          ['replication-set', topology.replication_set],
          ['region', 'qa-region'],
        ]) {
          await expect(advisorInsightsPage.builders.detailsField(field)).toContainText(value);
        }

        await expect(advisorInsightsPage.elements.detailsPane).toContainText('qa_label: qa-value');
      });
    },
  );
});
