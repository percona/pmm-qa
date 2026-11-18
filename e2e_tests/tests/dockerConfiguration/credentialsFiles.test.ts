import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import {
  credentialsServer,
  externalClickHouse,
  mysqlServiceName,
  secretsDir,
  secretsMount,
} from '@helpers/credentialsFiles.helper';

const secretsArgs = `-v ${secretsDir}:${secretsMount}:ro -e PMM_SECRETS_DIR=${secretsMount}`;
const serverAddress = `${credentialsServer.container}:8443`;
const postgresContainer = 'external-postgres';
const previousImage = process.env.PMM_SERVER_PREVIOUS_IMAGE || 'percona/pmm-server:3.10.0';
const webhook = { name: 'qa-webhook', password: 'HookCanary1', url: 'http://127.0.0.1:9999/qa-webhook' };

interface ContactPointsExport {
  contactPoints: { name: string; receivers: { settings: { password?: string } }[] }[];
}

pmmTest.describe('PMM Server credentials from files', () => {
  pmmTest.describe.configure({ retries: 0 });
  pmmTest.use({ baseURL: credentialsServer.baseUrl });

  pmmTest.beforeEach(async ({ credentialsFilesHelper }) => {
    credentialsFilesHelper.removeAll();
  });

  pmmTest.afterEach(async ({ credentialsFilesHelper, externalPostgresHelper }) => {
    credentialsFilesHelper.removeAll();
    externalPostgresHelper.removeAll();
  });

  pmmTest(
    'PMM-T2683 - Verify PMM Server takes the admin password and Grafana secret key from files in a secrets directory @docker-configuration',
    async ({ credentialsFilesHelper, loginPage, page }) => {
      await pmmTest.step('Start PMM Server with the credentials in a secrets directory', async () => {
        credentialsFilesHelper.writeSecrets({
          'admin-password': 'AdminCanary1',
          'grafana-secret-key': 'KeyCanary123',
        });
        await credentialsFilesHelper.startPmmServer(secretsArgs);
      });

      await pmmTest.step('Log in with the admin password from the file', async () => {
        await page.goto(loginPage.url);
        await loginPage.login('AdminCanary1');
        await expect(loginPage.inputs.password).toBeHidden();
      });

      for (const value of ['AdminCanary1', 'KeyCanary123']) {
        expect(
          credentialsFilesHelper.findLeaks(value),
          `${value} should not be in any process environment or configuration file`,
        ).toEqual([]);
      }

      expect(credentialsFilesHelper.listResolvedSecrets()).toEqual(
        expect.arrayContaining(['admin-password', 'grafana-secret-key']),
      );
    },
  );

  pmmTest(
    'PMM-T2684 - Verify a credential file variable takes precedence over the secrets directory @docker-configuration',
    async ({ credentialsFilesHelper, grafanaHelper, loginPage, page }) => {
      await pmmTest.step(
        'Start PMM Server with the admin password in a file variable and a secrets directory',
        async () => {
          credentialsFilesHelper.writeSecrets({
            'admin-file': 'FileCanary1',
            'admin-password': 'DirCanary1',
          });
          await credentialsFilesHelper.startPmmServer(
            `${secretsArgs} -e PMM_ADMIN_PASSWORD_FILE=${secretsMount}/admin-file`,
          );
        },
      );

      await pmmTest.step('Log in with the password from the file variable', async () => {
        await page.goto(loginPage.url);
        await loginPage.login('FileCanary1');
        await expect(loginPage.inputs.password).toBeHidden();
      });

      await pmmTest.step('Sign out and log in with the password from the secrets directory', async () => {
        await grafanaHelper.unAuthorize();
        await page.goto(loginPage.url);
        await loginPage.submitCredentials('DirCanary1');
        await expect(loginPage.messages.loginFailed).toBeVisible();
      });

      for (const value of ['FileCanary1', 'DirCanary1']) {
        expect(
          credentialsFilesHelper.findLeaks(value),
          `${value} should not be in any process environment or configuration file`,
        ).toEqual([]);
      }
    },
  );

  pmmTest(
    'PMM-T2685 - Verify the earlier credential environment variables still work and no longer reach PMM Server processes @docker-configuration',
    async ({ credentialsFilesHelper, grafanaHelper, loginPage, page }) => {
      await pmmTest.step('Start PMM Server with the admin password and secret key variables', async () => {
        await credentialsFilesHelper.startPmmServer(
          '-e GF_SECURITY_ADMIN_PASSWORD=EnvCanary1 -e GF_SECURITY_SECRET_KEY=EnvKeyCanary1',
        );
        await page.goto(loginPage.url);
        await loginPage.login('EnvCanary1');
        await expect(loginPage.inputs.password).toBeHidden();
      });

      for (const value of ['EnvCanary1', 'EnvKeyCanary1']) {
        expect(
          credentialsFilesHelper.findLeaks(value),
          `${value} should not be in any process environment or configuration file`,
        ).toEqual([]);
      }

      expect(
        credentialsFilesHelper.grafanaSecurityVariables(),
        'Grafana should get only a reference to the admin-password file',
      ).toEqual(['GF_SECURITY_ADMIN_PASSWORD=$__file{/run/pmm/secrets/admin-password}']);

      await pmmTest.step(
        'Recreate PMM Server with different GF_SECURITY_ADMIN_PASSWORD and PMM_ADMIN_PASSWORD',
        async () => {
          credentialsFilesHelper.removeAll();
          await credentialsFilesHelper.startPmmServer(
            '-e GF_SECURITY_ADMIN_PASSWORD=GfCanary1 -e PMM_ADMIN_PASSWORD=PmmCanary1',
          );
          await grafanaHelper.unAuthorize();
          await page.goto(loginPage.url);
          await loginPage.login('GfCanary1');
          await expect(loginPage.inputs.password).toBeHidden();
        },
      );

      const log = credentialsFilesHelper.readLog();

      expect(
        log.split('\n').filter((line) => line.includes('admin-password')),
        'A warning should say that PMM Server uses GF_SECURITY_ADMIN_PASSWORD over the different PMM_ADMIN_PASSWORD',
      ).toContainEqual(
        expect.stringMatching(
          /level=warning msg="Credential admin-password: PMM_ADMIN_PASSWORD .*GF_SECURITY_ADMIN_PASSWORD.*PMM Server uses/,
        ),
      );
      expect(log).not.toContain('GfCanary1');
      expect(log).not.toContain('PmmCanary1');
    },
  );

  pmmTest(
    'PMM-T2686 - Verify PMM Server reads the database passwords from files when it uses external PostgreSQL and ClickHouse @docker-configuration',
    async ({
      credentialsFilesHelper,
      dashboard,
      externalPostgresHelper,
      grafanaHelper,
      page,
      qanStoredMetrics,
      servicesPage,
      urlHelper,
    }) => {
      const passwords = {
        'clickhouse-datasource-password': 'ChDsCanary1',
        'clickhouse-password': 'ChCanary1',
        'grafana-db-password': 'GfDbCanary1',
        'postgres-password': 'PgCanary1',
      };

      await pmmTest.step(
        'Start external PostgreSQL and ClickHouse with users for PMM Server and Grafana',
        async () => {
          await externalPostgresHelper.startPostgres(
            postgresContainer,
            false,
            passwords['postgres-password'],
          );
          externalPostgresHelper.psql(postgresContainer, String.raw`CREATE DATABASE \"pmm-managed\"`);
          externalPostgresHelper.psql(
            postgresContainer,
            `CREATE USER grafana WITH PASSWORD '${passwords['grafana-db-password']}'; ALTER DATABASE grafana OWNER TO grafana`,
          );
          await credentialsFilesHelper.startClickHouse(
            passwords['clickhouse-password'],
            passwords['clickhouse-datasource-password'],
          );
        },
      );

      await pmmTest.step('Start PMM Server with the database passwords in a secrets directory', async () => {
        credentialsFilesHelper.writeSecrets(passwords);
        await credentialsFilesHelper.startPmmServer(
          `${secretsArgs} -e PMM_DISABLE_BUILTIN_POSTGRES=1 -e PMM_POSTGRES_ADDR=${postgresContainer}:5432
            -e PMM_POSTGRES_DBNAME=pmm-managed -e PMM_POSTGRES_USERNAME=postgres
            -e GF_DATABASE_TYPE=postgres -e GF_DATABASE_HOST=${postgresContainer}:5432 -e GF_DATABASE_NAME=grafana
            -e GF_DATABASE_USER=grafana -e PMM_DISABLE_BUILTIN_CLICKHOUSE=1
            -e PMM_CLICKHOUSE_ADDR=${externalClickHouse.container}:9000 -e PMM_CLICKHOUSE_DATABASE=pmm
            -e PMM_CLICKHOUSE_USER=${externalClickHouse.user}
            -e PMM_CLICKHOUSE_DATASOURCE_USER=${externalClickHouse.datasourceUser}`,
        );
        await credentialsFilesHelper.addMySqlWithLoad(serverAddress, 'admin');
      });

      await pmmTest.step('Log in and find the MySQL service in Inventory', async () => {
        await grafanaHelper.authorize('admin', 'admin', credentialsServer.baseUrl);
        await page.goto(servicesPage.url);
        await expect(servicesPage.builders.serviceNameCell(mysqlServiceName)).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
      });

      await pmmTest.step('Verify Query Analytics lists queries of the MySQL service', async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
            from: 'now-15m',
            refresh: '30s',
            serviceName: mysqlServiceName,
            to: 'now',
          }),
        );
        await qanStoredMetrics.waitUntilQanStoredMetricsLoaded(Timeouts.TEN_MINUTES);
      });

      await pmmTest.step('Verify the Home dashboard panels show data', async () => {
        await page.goto(dashboard.home.url);
        await dashboard.verifyAllPanelsHaveData(dashboard.home.noDataMetrics, Timeouts.TWO_MINUTES);
      });

      for (const name of [
        'clickhouse-password',
        'clickhouse-datasource-password',
        'grafana-db-password',
      ] as const) {
        expect(
          credentialsFilesHelper.findLeaks(passwords[name]),
          `${name} should not be in any process environment or configuration file`,
        ).toEqual([]);
      }

      pmmTest.info().annotations.push({
        description:
          'PMM-15891: postgres-password reaches the environment of postgres_exporter (DATA_SOURCE_NAME), as on 3.10.0. Not fixed yet.',
        type: 'known issue',
      });

      const postgresLeaks = credentialsFilesHelper.findLeaks(passwords['postgres-password']);

      // Expected failure: when the known issue is fixed, this list is empty; then assert toEqual([]) as above.
      expect(
        postgresLeaks,
        'Known issue PMM-15891: postgres-password is in postgres_exporter',
      ).not.toHaveLength(0);
      expect(
        postgresLeaks.filter((leak) => !/^\/proc\/\d+\/environ postgres_export/.test(leak)),
        'postgres-password should be nowhere but in the postgres_exporter environment of the known issue',
      ).toEqual([]);
    },
  );

  pmmTest(
    'PMM-T2687 - Verify upgrading a single Docker PMM Server from 3.10.0 without changing its variables keeps login, alert secrets and monitoring @docker-configuration',
    async ({
      alertingPage,
      clickHouseHelper,
      credentialsFilesHelper,
      loginPage,
      page,
      qanStoredMetrics,
      urlHelper,
    }) => {
      pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);

      const upgradeArgs = '-e GF_SECURITY_ADMIN_PASSWORD=UpgCanary1 -e GF_SECURITY_SECRET_KEY=UpgKeyCanary1';
      const authHeader = GrafanaHelper.getAuthHeader('admin', 'UpgCanary1');

      await pmmTest.step('Start PMM Server 3.10.0 with MySQL and a webhook contact point', async () => {
        await credentialsFilesHelper.startPmmServer(upgradeArgs, previousImage);
        await credentialsFilesHelper.addMySqlWithLoad(serverAddress, 'UpgCanary1');

        const response = await page.request.post('graph/api/v1/provisioning/contact-points', {
          data: {
            name: webhook.name,
            settings: { password: webhook.password, url: webhook.url, username: 'qa' },
            type: 'webhook',
          },
          // Without provenance the contact point stays editable in the UI, as one created there.
          headers: { ...authHeader, 'X-Disable-Provenance': 'true' },
        });

        expect(response.status(), await response.text()).toEqual(202);
      });

      // QAN buckets are whole minutes; the check below starts two minutes before the upgrade.
      const checkFrom = Math.floor(Date.now() / 60_000) * 60 - 120;

      await pmmTest.step('Replace the image on the same volume with the same variables', async () => {
        credentialsFilesHelper.stopPmmServer();
        await credentialsFilesHelper.startPmmServer(upgradeArgs);
      });

      await pmmTest.step('Log in as admin with the unchanged password', async () => {
        await page.goto(loginPage.url);
        // An upgraded server opens Home or the Help Center, depending on the welcome state.
        await loginPage.login('UpgCanary1', /pmm-ui/);
        await expect(loginPage.inputs.password).toBeHidden();
      });

      await pmmTest.step('Open the contact point for editing', async () => {
        await page.goto(alertingPage.urls.contactPoints);
        await alertingPage.builders.contactPointEdit(webhook.name).click();
        await alertingPage.buttons.optionalWebhookSettings.click();
        await expect(alertingPage.elements.contactPointUrl).toHaveValue(webhook.url);
        await expect(alertingPage.messages.contactPointFetchFailed).toBeHidden();
        await expect(alertingPage.elements.contactPointWebhookPassword).toHaveValue('configured');
        await expect(alertingPage.elements.contactPointWebhookPassword).toBeDisabled();
      });

      const exported = await page.request.get(
        'graph/api/v1/provisioning/contact-points/export?decrypt=true&format=json',
        { headers: authHeader },
      );

      expect(exported.status(), await exported.text()).toEqual(200);
      expect(
        ((await exported.json()) as ContactPointsExport).contactPoints
          .filter((contactPoint) => contactPoint.name === webhook.name)
          .flatMap((contactPoint) => contactPoint.receivers.map((receiver) => receiver.settings.password)),
        'The webhook password should still decrypt with the unchanged secret key',
      ).toEqual([webhook.password]);

      await pmmTest.step(
        'Wait 5 minutes and verify Query Analytics lists queries of the MySQL service',
        async () => {
          // eslint-disable-next-line playwright/no-wait-for-timeout -- the case waits for QAN data after the upgrade
          await page.waitForTimeout(Timeouts.FIVE_MINUTES);
          await page.goto(
            urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
              from: 'now-15m',
              refresh: '30s',
              serviceName: mysqlServiceName,
              to: 'now',
            }),
          );
          await qanStoredMetrics.waitUntilQanStoredMetricsLoaded(Timeouts.TWO_MINUTES);
        },
      );

      const checkTo = Math.floor(Date.now() / 60_000) * 60 - 120;
      const minutesWithQueries = Number(
        clickHouseHelper
          .query(
            credentialsServer.container,
            `SELECT count(DISTINCT toStartOfMinute(period_start)) FROM pmm.metrics
              WHERE service_name = '${mysqlServiceName}'
              AND period_start >= toDateTime(${checkFrom}) AND period_start < toDateTime(${checkTo})`,
          )
          .stdout.trim(),
      );

      expect(minutesWithQueries, 'Every minute across the upgrade should have queries, with no gap').toEqual(
        (checkTo - checkFrom) / 60,
      );

      for (const value of ['UpgCanary1', 'UpgKeyCanary1']) {
        expect(
          credentialsFilesHelper.findLeaks(
            value,
            credentialsServer.container,
            '/proc/[0-9]*/environ /etc/grafana /etc/supervisord.d',
          ),
          `${value} should not be in any process environment or configuration file`,
        ).toEqual([]);
      }
    },
  );
});
