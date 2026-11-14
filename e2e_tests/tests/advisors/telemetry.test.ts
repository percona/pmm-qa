import Api from '@api/api';
import AdvisorsApi from '@api/advisors.api';
import MailpitApi from '@api/mailpit.api';
import pmmTest from '@fixtures/pmmTest';
import CliHelper from '@helpers/cli.helper';
import DockerHelper from '@helpers/docker.helper';
import TelemetryHelper, { TelemetryCapture } from '@helpers/telemetry.helper';
import { Timeouts } from '@helpers/timeouts';
import {
  AdvisorCheckResultStatus,
  AdvisorRunStatus,
  AdvisorSchedule,
  AdvisorScheduleEmailMode,
  AdvisorTriggeredBy,
} from '@interfaces/advisors';
import { APIRequestContext, expect } from '@playwright/test';

const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';

pmmTest.describe.configure({ mode: 'default' });

const checkMetrics = [
  'pmm_managed_advisor_checks_available',
  'pmm_managed_advisor_checks_executed_total',
  'pmm_managed_advisor_check_execution_time_seconds',
  'pmm_managed_advisor_check_insights',
];

pmmTest.describe('Advisor metrics', () => {
  const createdChecks: string[] = [];
  let notifications: Record<string, unknown>;
  let schedules: AdvisorSchedule[];

  // The default daily schedule would add a run, and an email, to a test that crosses 06:00 UTC.
  pmmTest.beforeEach(async ({ api }) => {
    notifications = await api.settingsApi.getAdvisorNotifications();
    schedules = await api.advisorsApi.listSchedules();
    await api.advisorsApi.deleteAllSchedules();
  });

  pmmTest.afterEach(async ({ api }) => {
    for (const name of createdChecks.splice(0)) await api.advisorsApi.deleteCheck(name);

    await api.settingsApi.updateSettings(notifications);
    await api.advisorsApi.restoreSchedules(schedules);
  });

  pmmTest(
    'PMM-Txxxx - Verify the Advisor check metrics label each check with its source @advisor-telemetry',
    async ({ api }) => {
      const check = await api.advisorsApi.createCustomCheck();

      createdChecks.push(check.name);
      await api.advisorsApi.runChecksAndWait([], [], Timeouts.FIVE_MINUTES);

      for (const metric of checkMetrics) {
        await pmmTest.step(`${metric} carries source="user" for a user check only`, async () => {
          await expect
            .poll(
              async () => [
                ...new Set(
                  (await api.prometheusApi.instantQuery(`${metric}{check_name="${check.name}"}`)).map(
                    ({ metric: labels }) => labels.source,
                  ),
                ),
              ],
              { message: `${metric} has no series of ${check.name}`, timeout: Timeouts.TWO_MINUTES },
            )
            .toEqual(['user']);

          const builtin = await api.prometheusApi.instantQuery(`${metric}{source="builtin"}`);
          const unlabelled = await api.prometheusApi.instantQuery(`${metric}{source!~"builtin|user"}`);

          expect(builtin.length, `${metric} has no built-in series`).toBeGreaterThan(0);
          expect(builtin.map(({ metric: labels }) => labels.check_name)).not.toContainEqual(
            expect.stringMatching(/^custom_/),
          );
          expect(unlabelled, `${metric} has series without a source`).toEqual([]);
        });
      }
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify the Advisor email metric counts sent emails by kind @advisor-telemetry',
    async ({ api }) => {
      const recipient = MailpitApi.recipient('telemetry');
      const counter = (kind: string, result: string) =>
        api.prometheusApi.instantQueryValue(
          `pmm_managed_advisor_notifications_total{kind="${kind}",result="${result}"}`,
        );
      const kinds = ['run', 'shared', 'test'];
      const counts = async () =>
        Object.fromEntries(
          await Promise.all(
            kinds.flatMap((kind) =>
              ['sent', 'failed'].map(async (result) => [`${kind}/${result}`, await counter(kind, result)]),
            ),
          ),
        ) as Record<string, number | undefined>;
      const before = await counts();

      await pmmTest.step('All six series exist before any email is counted', async () => {
        for (const [series, value] of Object.entries(before)) {
          expect(value, `${series} is not exported`).toBeDefined();
        }
      });

      const check = await api.advisorsApi.createCustomCheck({
        script: AdvisorsApi.findingsScript(1, 'error'),
      });

      createdChecks.push(check.name);
      await api.settingsApi.updateSettings({
        advisor_notification_email_addresses: { values: [recipient] },
        enable_advisor_notifications: true,
      });

      await pmmTest.step(
        'A test email, a run email and a shared insights email each count as sent',
        async () => {
          const testResponse = await api.advisorsApi.requestTestNotification([recipient], ['SEVERITY_ERROR']);

          expect(testResponse.status(), await testResponse.text()).toEqual(200);

          const run = await api.advisorsApi.runChecksAndWait([check.name]);

          await expect
            .poll(async () => (await api.mailpitApi.messagesTo(recipient)).length, {
              message: `The emails of the test and of run ${run.id} did not reach ${recipient}`,
              timeout: Timeouts.ONE_MINUTE,
            })
            .toEqual(2);

          const shareResponse = await api.advisorsApi.requestEmailInsights([recipient], { run_id: run.id });

          expect(shareResponse.status(), await shareResponse.text()).toEqual(200);
          await expect
            .poll(async () => (await api.mailpitApi.messagesTo(recipient)).length, {
              message: `The shared insights of run ${run.id} did not reach ${recipient}`,
              timeout: Timeouts.ONE_MINUTE,
            })
            .toEqual(3);
        },
      );

      await pmmTest.step('Each kind counted one sent email and no failed one', async () => {
        const expected = Object.fromEntries(
          Object.entries(before).map(([series, value]) => [
            series,
            (value as number) + (series.endsWith('/sent') ? 1 : 0),
          ]),
        );

        await expect
          .poll(counts, {
            message: 'The email counts did not change as expected',
            timeout: Timeouts.TWO_MINUTES,
          })
          .toEqual(expected);
      });
    },
  );
});

pmmTest.describe.serial('Advisor telemetry report', () => {
  const container = 'pmm-server-advisor-telemetry';
  const port = 460;
  const cliHelper = new CliHelper();
  const telemetry = new TelemetryHelper(cliHelper, container);

  const reportOf = (keys: string[]): TelemetryCapture => {
    const capture = telemetry.latestCapture();

    return Object.fromEntries(keys.map((key) => [key, capture[key]]));
  };

  const serviceIds: string[] = [];
  let api: Api;
  let request: APIRequestContext;
  let canary: string;

  pmmTest.beforeAll(async ({ playwright }) => {
    const mysql = cliHelper
      .execSilent('docker ps --filter name=ps_pmm_ --format "{{.Names}}"')
      .assertSuccess()
      .stdout.trim()
      .split('\n')[0];

    expect(mysql, 'No ps_pmm_* container from pmm-framework is running').toBeTruthy();

    const mysqlPassword = cliHelper
      .execSilent(`docker exec ${mysql} printenv MYSQL_ROOT_PASSWORD`)
      .assertSuccess()
      .stdout.trim();

    cliHelper.removeContainer(container);
    // SMTP points at a closed port, so every Advisor email from this server fails.
    new DockerHelper(cliHelper).startContainer(
      container,
      `--publish ${port}:8443 -e GF_SECURITY_ADMIN_PASSWORD=${adminPassword} -e PMM_DEBUG=1` +
        ' -e PMM_DEV_TELEMETRY_INTERVAL=15s -e PMM_DEV_TELEMETRY_DISABLE_SEND=1' +
        ' -e PMM_DEV_TELEMETRY_DISABLE_START_DELAY=1' +
        ' -e GF_SMTP_ENABLED=true -e GF_SMTP_HOST=127.0.0.1:2525 -e GF_SMTP_FROM_ADDRESS=pmm@example.com' +
        ` ${dockerVersion}`,
    );

    request = await playwright.request.newContext({
      baseURL: `https://127.0.0.1:${port}/`,
      ignoreHTTPSErrors: true,
    });
    api = new Api(request);
    await api.serverApi.waitForReady(Timeouts.FIVE_MINUTES);

    // Two services on one database, so every built-in check that fails reports it twice.
    for (const name of ['telemetry-mysql-1', 'telemetry-mysql-2']) {
      const { service_id } = await api.managementApi.addRemoteDatabase('mysql', name, 3_306, {
        address: mysql,
        password: mysqlPassword,
        username: 'root',
      });

      serviceIds.push(service_id);
    }

    // The default daily schedule would add a run, and a failed email, to a test that crosses 06:00 UTC.
    await api.advisorsApi.deleteAllSchedules();
    canary = `custom_telemetry_canary_${Date.now()}`;
    await api.advisorsApi.createCustomCheck({ name: canary });
    await api.advisorsApi.runChecksAndWait([], [], Timeouts.FIVE_MINUTES);
  });

  pmmTest.afterAll(async () => {
    await request?.dispose();
    cliHelper.removeContainer(container);
  });

  pmmTest(
    'PMM-Txxxx - Verify PMM_DEV_TELEMETRY_DISABLE_START_DELAY=1 makes telemetry report on start @advisor-telemetry',
    async () => {
      expect(telemetry.grepLog('Sending telemetry on start is enabled, in progress...')).not.toEqual('');
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify Advisor telemetry leaves out the names of user checks @advisor-telemetry',
    async () => {
      await pmmTest.step('The user check has series in every check metric', async () => {
        for (const metric of checkMetrics) {
          await expect
            .poll(
              async () =>
                (await api.prometheusApi.instantQuery(`${metric}{check_name="${canary}",source="user"}`))
                  .length,
              { message: `${metric} has no series of ${canary}`, timeout: Timeouts.TWO_MINUTES },
            )
            .toBeGreaterThan(0);
        }
      });

      await pmmTest.step('Reports name built-in checks, but never the user check', async () => {
        const capture = await telemetry.waitForFreshCapture();

        for (const key of [
          'advisor_checks_available',
          'advisor_checks_executed_total',
          'advisor_check_insights',
          'advisor_check_execution_time_seconds',
        ]) {
          const names = TelemetryHelper.jsonEntries(capture[key]).map(([name]) => name);

          expect(names.length, `${key} names no check`).toBeGreaterThan(0);
          expect(names, key).not.toContainEqual(expect.stringMatching(/^custom_/));
        }
      });

      await pmmTest.step('Disabling the user check keeps its name out of the disabled list', async () => {
        const builtin = await api.advisorsApi.getBuiltinCheck();

        await api.advisorsApi.changeCheck(canary, { enable: false });
        await api.advisorsApi.changeCheck(builtin.name, { enable: false });

        await telemetry.waitForFreshCapture();
        await expect
          .poll(() => reportOf(['advisor_checks_disabled']), {
            message: 'advisor_checks_disabled did not list exactly the disabled built-in check',
            timeout: Timeouts.FIVE_MINUTES,
          })
          .toEqual({
            advisor_checks_disabled: JSON.stringify({
              v: [{ advisor_checks_disabled: `["${builtin.name}"]` }],
            }),
          });
        await api.advisorsApi.changeCheck(canary, { enable: true });
        await api.advisorsApi.changeCheck(builtin.name, { enable: true });
      });

      await pmmTest.step('No report in the whole log names the user check', async () => {
        const captures = telemetry.captures();

        expect(captures.length).toBeGreaterThan(0);

        for (const capture of captures) expect(JSON.stringify(capture)).not.toContain(canary);
      });
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify advisor_check_insights reports one entry per built-in check @advisor-telemetry',
    async () => {
      const run = await api.advisorsApi.runChecksAndWait([], [], Timeouts.FIVE_MINUTES);
      const insights = (await api.advisorsApi.listInsights({ page_size: '1000', run_id: run.id })).filter(
        ({ check_name, status }) =>
          status === AdvisorCheckResultStatus.failed && !check_name.startsWith('custom_'),
      );
      const expected = new Map<string, number>();

      for (const { check_name } of insights) expected.set(check_name, (expected.get(check_name) ?? 0) + 1);

      const onBothServices = [...expected.keys()].filter((name) =>
        serviceIds.every((id) =>
          insights.some(({ check_name, service_id }) => check_name === name && service_id === id),
        ),
      );

      expect(onBothServices, 'No built-in check fails on both services').not.toEqual([]);

      await telemetry.waitForFreshCapture();
      await expect
        .poll(
          () =>
            TelemetryHelper.jsonEntries(telemetry.latestCapture().advisor_check_insights).sort(([a], [b]) =>
              a.localeCompare(b),
            ),
          {
            message: 'advisor_check_insights did not match the insights of the run',
            timeout: Timeouts.FIVE_MINUTES,
          },
        )
        .toEqual(
          [...expected.entries()]
            .map(([name, count]) => [name, String(count)])
            .sort(([a], [b]) => a.localeCompare(b)),
        );
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify the Advisor usage telemetry keys match the server state @advisor-telemetry',
    async () => {
      const recipients = ['qa-telemetry-1@example.com', 'qa-telemetry-2@example.com'];
      const [first, second, scoped] = (await api.advisorsApi.listChecks())
        .filter(({ enabled, user_defined }) => !user_defined && enabled)
        .map(({ name }) => name);

      await pmmTest.step('Change checks, schedules, notification settings and retention', async () => {
        await api.advisorsApi.changeCheck(first, { enable: false });
        await api.advisorsApi.changeCheck(second, { enable: false });
        await api.advisorsApi.changeCheck(scoped, { enable: false, service_ids: [serviceIds[0]] });
        await api.advisorsApi.createSchedule({
          email_addresses: ['qa-telemetry-schedule@example.com'],
          email_mode: AdvisorScheduleEmailMode.custom,
          email_severities: ['SEVERITY_WARNING'],
        });
        await api.advisorsApi.createSchedule({ email_mode: AdvisorScheduleEmailMode.off });
        await api.advisorsApi.createSchedule({
          email_addresses: ['qa-off@example.com'],
          email_mode: AdvisorScheduleEmailMode.custom,
          enabled: false,
        });
        await api.settingsApi.updateSettings({
          advisor_history_retention: '1209600s',
          advisor_notification_email_addresses: { values: recipients },
          enable_advisor_notifications: true,
        });
      });

      await pmmTest.step('A due schedule runs, and a test email fails', async () => {
        const { at } = AdvisorsApi.nextDueMinute();
        const schedule = await api.advisorsApi.createDueSchedule(at, {
          check_names: [canary],
          email_mode: AdvisorScheduleEmailMode.off,
        });

        await api.advisorsApi.waitForScheduledRun(schedule.schedule_id, Timeouts.FIVE_MINUTES);

        const response = await api.advisorsApi.requestTestNotification(recipients, ['SEVERITY_ERROR']);

        expect(response.status(), 'The test email to a closed SMTP port did not fail').toEqual(500);
      });

      await pmmTest.step('Every usage key matches the API', async () => {
        const checks = await api.advisorsApi.listChecks();
        const schedules = await api.advisorsApi.listSchedules();
        const dayAgo = Date.now() - 24 * Timeouts.SIXTY_MINUTES;
        const runs = (await api.advisorsApi.listRuns({ page_size: '1000' })).filter(
          ({ started_at }) => Date.parse(started_at) > dayAgo,
        );
        const enabled = schedules.filter(({ enabled }) => enabled);
        const sum = (values: number[]) => String(values.reduce((total, value) => total + value, 0));

        expect(runs.some(({ triggered_by }) => triggered_by === AdvisorTriggeredBy.scheduler)).toBe(true);

        const expected = {
          advisor_builtin_checks_disabled_count: String(
            checks.filter(({ enabled, user_defined }) => !user_defined && !enabled).length,
          ),
          advisor_checks_disabled_for_some_services_count: String(
            checks.filter(({ disabled_service_ids }) => disabled_service_ids?.length).length,
          ),
          advisor_findings_24h: sum(runs.map(({ findings_count }) => findings_count ?? 0)),
          advisor_notifications_failed_24h: '1',
          advisor_notifications_sent_24h: '0',
          advisor_run_errors_24h: sum(runs.map(({ errors_count }) => errors_count ?? 0)),
          advisor_runs_24h: String(runs.length),
          advisor_runs_by_user_24h: String(
            runs.filter(({ triggered_by }) => triggered_by === AdvisorTriggeredBy.user).length,
          ),
          advisor_runs_not_completed_24h: String(
            runs.filter(({ status }) =>
              [AdvisorRunStatus.aborted, AdvisorRunStatus.interrupted].includes(status),
            ).length,
          ),
          advisor_runs_scheduled_24h: String(
            runs.filter(({ triggered_by }) => triggered_by === AdvisorTriggeredBy.scheduler).length,
          ),
          advisor_schedules_count: String(schedules.length),
          advisor_schedules_custom_email: String(
            enabled.filter(({ email_mode }) => email_mode === AdvisorScheduleEmailMode.custom).length,
          ),
          advisor_schedules_email_off: String(
            enabled.filter(({ email_mode }) => email_mode === AdvisorScheduleEmailMode.off).length,
          ),
          advisor_schedules_enabled: String(enabled.length),
          advisor_user_checks_count: String(checks.filter(({ user_defined }) => user_defined).length),
          pmm_server_advisor_history_retention: String(1_209_600 * 1e9),
          pmm_server_advisor_notification_recipients_count: String(recipients.length),
          pmm_server_advisor_notifications_enabled: '1',
        };

        // The VictoriaMetrics-backed email keys lag a scrape behind the database-backed ones.
        await telemetry.waitForFreshCapture();
        await expect
          .poll(() => reportOf(Object.keys(expected)), {
            message: 'The Advisor usage keys did not match the API',
            timeout: Timeouts.FIVE_MINUTES,
          })
          .toEqual(expected);
      });
    },
  );
});
