import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import CliHelper from '@helpers/cli.helper';
import { rdsPort } from '@api/management.api';
import MySQLHelper from '@helpers/mysql.helper';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';
import QueryAnalyticsPage from '@pages/qan/queryAnalytics.page';
import { expect } from '@playwright/test';

const remoteMySqlPassword = 'rta-QA-mysql-1';
const containers: string[] = [];
const databases: MySQLHelper[] = [];
const mySqlRestores: string[] = [];
const nodeNames: string[] = [];
const serviceIds: string[] = [];
// The data directory is on tmpfs: initializing several servers at once on disk takes minutes.
const mySqlContainerArgs = `--network pmm-qa --tmpfs /var/lib/mysql:mode=1777 --env MYSQL_ROOT_PASSWORD=${remoteMySqlPassword}`;

// PMM Server's own agent monitors it by name over the pmm-qa network; the test reaches it on a published port.
const addRemoteMySql = async (api: Api, cliHelper: CliHelper, serviceName: string, dockerArgs: string) => {
  cliHelper.removeContainer(serviceName);
  await api.inventoryApi.removeNodesByName([serviceName]);
  containers.push(serviceName);
  nodeNames.push(serviceName);
  cliHelper
    .execute(
      `docker run --detach --quiet --name ${serviceName} --publish 127.0.0.1::3306 ${mySqlContainerArgs} ${dockerArgs}`,
      Timeouts.FIVE_MINUTES,
    )
    .assertSuccess();

  const port = Number(
    cliHelper
      .execSilent(`docker port ${serviceName} 3306/tcp`)
      .assertSuccess()
      .stdout.trim()
      .split(':')
      .at(-1),
  );
  const db = new MySQLHelper({ host: '127.0.0.1', password: remoteMySqlPassword, port, username: 'root' });

  databases.push(db);
  // The image initializes on a server without networking, so TCP answers only once the real server is up.
  await expect(async () => {
    await db.query('SELECT 1');
  }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

  const { mysql } = await api.managementApi.addService({
    mysql: {
      add_node: { node_name: serviceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
      address: serviceName,
      password: remoteMySqlPassword,
      pmm_agent_id: 'pmm-server',
      port: 3_306,
      qan_mysql_perfschema: true,
      service_name: serviceName,
      username: 'root',
    },
  });

  if (!mysql) throw new Error(`Adding ${serviceName} returned no MySQL service`);

  return { db, serviceId: mysql.service.service_id, serviceName };
};

const startSessionFromSelection = async (queryAnalytics: QueryAnalyticsPage, serviceIds: string[]) => {
  await queryAnalytics.rta.selectServiceOptions(serviceIds);
  await queryAnalytics.buttons.startSessionButton.click();

  await expect(queryAnalytics.rta.elements.realTimeTable).toBeVisible();
};

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await api.realTimeAnalyticsApi.stopAllSessions();
});

pmmTest.afterEach(async ({ api, cliHelper, mySqlDbHelper }) => {
  await api.realTimeAnalyticsApi.stopAllSessions();

  for (const sql of mySqlRestores.splice(0)) await mySqlDbHelper.query(sql);

  for (const db of databases.splice(0)) await db.close();

  for (const serviceId of serviceIds.splice(0)) await api.managementApi.removeService(serviceId);

  await api.inventoryApi.removeNodesByName(nodeNames.splice(0));

  for (const container of containers.splice(0)) cliHelper.removeContainer(container);
});

pmmTest(
  'Verify a running statement on each MySQL flavor shows in Real-Time Analytics within 5 seconds @rta',
  async ({ api, cliHelper, mySqlDbHelper, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const percona84 = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm_8_4_');
    const remoteFlavors = await Promise.all([
      addRemoteMySql(api, cliHelper, 'rta-ps-80', 'percona/percona-server:8.0'),
      addRemoteMySql(api, cliHelper, 'rta-mysql-84', 'mysql:8.4'),
      addRemoteMySql(api, cliHelper, 'rta-mysql-80', 'mysql:8.0'),
      addRemoteMySql(api, cliHelper, 'rta-mysql-57', '--platform linux/amd64 mysql:5.7'),
      // RTA needs performance_schema, which MariaDB leaves off by default.
      addRemoteMySql(api, cliHelper, 'rta-mariadb-118', 'mariadb:11.8 --performance-schema=ON'),
    ]);
    const flavors = [
      {
        db: mySqlDbHelper,
        serviceId: percona84.service_id,
        serviceName: percona84.service_name,
        sessionName: percona84.cluster || percona84.service_name,
      },
      ...remoteFlavors.map((flavor) => ({ ...flavor, sessionName: flavor.serviceName })),
    ];

    await pmmTest.step('Open the Real-Time tab of Query Analytics', async () => {
      await page.goto(queryAnalytics.url);
      await queryAnalytics.switchTab(queryAnalytics.tabNames.realTime);

      await expect(rta.inputs.clusterService).toBeVisible();
      await expect(queryAnalytics.buttons.startSessionButton).toBeVisible();
    });

    await pmmTest.step(
      'Open Cluster/Service and verify every MySQL flavor is listed under MySQL',
      async () => {
        await rta.inputs.clusterService.click();

        await expect(rta.builders.technologyGroupHeader('MongoDB')).toBeVisible();

        for (const { serviceId } of flavors) {
          await expect(rta.builders.serviceOptionInGroup('MySQL', serviceId)).toBeVisible();
        }
      },
    );

    await pmmTest.step('Start a session for the six MySQL services', async () => {
      await startSessionFromSelection(
        queryAnalytics,
        flavors.map(({ serviceId }) => serviceId),
      );
    });

    await pmmTest.step(
      'Verify each labelled statement is listed within 5 seconds with its host',
      async () => {
        await rta.setQueryTextFilter('rta-flavor-');

        for (const { db, serviceName } of flavors) {
          const queryLabel = `rta-flavor-${serviceName}`;

          void db.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });

          await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible({
            timeout: Timeouts.FIVE_SECONDS,
          });
          await expect(rta.builders.hostForQueryByText(queryLabel)).toHaveText(serviceName);
        }
      },
    );

    await pmmTest.step('Verify six running MySQL sessions are listed', async () => {
      await rta.buttons.allSessions.click();

      await expect(rta.elements.sessionRows).toHaveCount(flavors.length);

      for (const { sessionName } of flavors) {
        await expect(rta.builders.technologyForSession(sessionName)).toHaveText('MySQL');
        await expect(rta.builders.sessionStatus(sessionName)).toHaveText(/^Running for /);
      }
    });

    await pmmTest.step(
      'Verify the MySQL 5.7 session names the consumer and instrument it misses',
      async () => {
        await rta.builders.sessionStatusMessage('rta-mysql-57').hover();

        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          rta.expectedTexts.sessionWarningsIntro,
        );
        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          'The events_transactions_current consumer and the transaction instrument are disabled',
        );
        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          rta.expectedTexts.consumerRemedy('events_transactions_current'),
        );
        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          'The wait/lock/metadata/sql/mdl instrument is disabled',
        );
        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          rta.expectedTexts.instrumentRemedy('wait/lock/metadata/sql/mdl'),
        );
      },
    );

    await pmmTest.step('Verify the MariaDB session names the disabled statements consumer', async () => {
      await page.mouse.move(0, 0);

      await expect(rta.elements.sessionStatusMessageTooltip).toBeHidden();

      await rta.builders.sessionStatusMessage('rta-mariadb-118').hover();

      await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
        rta.expectedTexts.statementsConsumerDisabled,
      );
      await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
        rta.expectedTexts.consumerRemedy('events_statements_current'),
      );
    });

    await rta.stopAllSessions();
  },
);

pmmTest(
  'Verify a MySQL service on a PMM Client without the MySQL collector cannot be selected or started in Real-Time Analytics @rta',
  async ({ api, cliHelper, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const mongoDbContainer = 'rta-old-client-mongodb';
    const mySqlContainer = 'rta-old-client-mysql';
    const clients = [
      { container: 'rta-client-310', image: 'percona/pmm-client:3.10.0', mySqlService: 'mysql-client-310' },
      {
        container: 'rta-client-311',
        image: 'perconalab/pmm-client:3.11.0-rc',
        mySqlService: 'mysql-client-311',
      },
    ];

    await pmmTest.step('Connect PMM Client 3.10.0 and 3.11.0 containers with their services', async () => {
      for (const container of [
        mongoDbContainer,
        mySqlContainer,
        ...clients.map((client) => client.container),
      ]) {
        cliHelper.removeContainer(container);
        containers.push(container);
      }

      await api.inventoryApi.removeNodesByName(clients.map((client) => client.container));
      nodeNames.push(...clients.map((client) => client.container));
      cliHelper
        .execute(
          `docker run --detach --quiet --name ${mySqlContainer} ${mySqlContainerArgs} mysql:8.4`,
          Timeouts.FIVE_MINUTES,
        )
        .assertSuccess();
      cliHelper
        .execute(
          `docker run --detach --quiet --name ${mongoDbContainer} --network pmm-qa mongo:8.0`,
          Timeouts.FIVE_MINUTES,
        )
        .assertSuccess();

      for (const { container, image } of clients) {
        cliHelper
          .execute(
            [
              `docker run --detach --quiet --name ${container} --network pmm-qa`,
              '--env PMM_AGENT_SETUP=1 --env PMM_AGENT_SERVER_ADDRESS=pmm-server:8443',
              `--env PMM_AGENT_SERVER_USERNAME=admin --env PMM_AGENT_SERVER_PASSWORD='${process.env.ADMIN_PASSWORD || 'admin'}'`,
              '--env PMM_AGENT_SERVER_INSECURE_TLS=1 --env PMM_AGENT_CONFIG_FILE=config/pmm-agent.yaml',
              `--env PMM_AGENT_SETUP_NODE_NAME=${container} --env PMM_AGENT_SETUP_FORCE=1 --env PMM_AGENT_SETUP_NODE_TYPE=container`,
              image,
            ].join(' '),
            Timeouts.FIVE_MINUTES,
          )
          .assertSuccess();
      }

      // Each add retries until its pmm-agent is connected and the database accepts connections.
      for (const { container, mySqlService } of clients) {
        await expect(() => {
          cliHelper
            .execute(
              `docker exec ${container} pmm-admin add mysql --username=root --password=${remoteMySqlPassword} --host=${mySqlContainer} --port=3306 --query-source=perfschema ${mySqlService}`,
            )
            .assertSuccess();
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      }

      await expect(() => {
        cliHelper
          .execute(
            `docker exec ${clients[0].container} pmm-admin add mongodb --host=${mongoDbContainer} --port=27017 mongo-client-310`,
          )
          .assertSuccess();
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });

    const mongoDb310 = await api.inventoryApi.getServiceDetailsByRegex('^mongo-client-310$');
    const mySql310 = await api.inventoryApi.getServiceDetailsByRegex('^mysql-client-310$');
    const mySql311 = await api.inventoryApi.getServiceDetailsByRegex('^mysql-client-311$');

    // Soft, so one run reports every claim the agent version cutoff decides.
    await pmmTest.step('Verify only the MongoDB service of the old clients is offered', async () => {
      await page.goto(queryAnalytics.url);
      await queryAnalytics.switchTab(queryAnalytics.tabNames.realTime);
      await rta.inputs.clusterService.click();

      await expect(rta.builders.serviceOptionInGroup('MongoDB', mongoDb310.service_id)).toBeVisible();
      await expect.soft(rta.builders.serviceOption(mySql310.service_id)).toHaveCount(0);
      await expect.soft(rta.builders.serviceOption(mySql311.service_id)).toHaveCount(0);
    });

    for (const [service, agentVersion] of [
      [mySql310, '3.10.0'],
      [mySql311, '3.11.0'],
    ] as const) {
      await pmmTest.step(
        `Verify the API refuses to start a session for ${service.service_name}`,
        async () => {
          const response = await api.realTimeAnalyticsApi.startRealTimeAnalytics(service.service_id);

          expect.soft(response.status(), await response.text()).toEqual(400);
          expect
            .soft(((await response.json()) as { message?: string }).message)
            .toEqual(rta.expectedTexts.agentTooOld(service.service_name, service.service_id, agentVersion));
        },
      );
    }

    await pmmTest.step('Verify All sessions lists no session for the MySQL services', async () => {
      await page.goto(queryAnalytics.rtaSessionsUrl);

      await expect(rta.elements.sessionsTable).toBeVisible();
      await expect.soft(rta.builders.sessionRow(mySql310.service_name)).toHaveCount(0);
      await expect.soft(rta.builders.sessionRow(mySql311.service_name)).toHaveCount(0);
    });
  },
);

pmmTest(
  'Verify Real-Time Analytics explains why it cannot start for a MySQL server with Performance Schema off @rta',
  async ({ agentsPage, api, cliHelper, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const { serviceId, serviceName } = await addRemoteMySql(
      api,
      cliHelper,
      'mysql-no-perfschema',
      'mysql:8.4 --performance-schema=OFF',
    );

    await pmmTest.step('Start a session for the service and verify the view says why it failed', async () => {
      await page.goto(queryAnalytics.url);
      await queryAnalytics.switchTab(queryAnalytics.tabNames.realTime);
      await rta.inputs.clusterService.click();
      await startSessionFromSelection(queryAnalytics, [serviceId]);

      await expect(rta.elements.realTimeTableRow).toHaveText(
        rta.expectedTexts.sessionError(serviceName, rta.expectedTexts.performanceSchemaDisabled),
        { timeout: Timeouts.THIRTY_SECONDS },
      );
    });

    await pmmTest.step('Verify the session shows Error with a warning icon and the same reason', async () => {
      await rta.buttons.allSessions.click();

      await expect(rta.builders.sessionStatus(serviceName)).toHaveText('Error');
      await expect(rta.builders.sessionStatusIcon(serviceName)).toBeVisible();

      await rta.builders.sessionStatusMessage(serviceName).hover();

      await expect(rta.elements.sessionStatusMessageTooltip).toHaveText(
        rta.expectedTexts.performanceSchemaDisabled,
      );
    });

    await pmmTest.step('Verify the MySQL exporter of the service keeps running', async () => {
      await page.goto(agentsPage.serviceAgentsUrl(serviceId));

      await expect(agentsPage.builders.agentStatus('MySQL exporter')).toHaveText('Running');
    });
  },
);

pmmTest(
  'Verify MySQL statement details that MySQL does not measure show as Unavailable and the session says why @rta',
  async ({ api, mySqlDbHelper, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-mysql-unmeasured';
    const percona84 = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm_8_4_');
    const consumerState = (enabled: string) =>
      `UPDATE performance_schema.setup_consumers SET ENABLED='${enabled}' WHERE NAME='events_statements_current'`;

    await pmmTest.step('Turn the events_statements_current consumer off', async () => {
      const [{ ENABLED }] = await mySqlDbHelper.query(
        "SELECT ENABLED FROM performance_schema.setup_consumers WHERE NAME='events_statements_current'",
      );

      mySqlRestores.push(consumerState(ENABLED));
      await mySqlDbHelper.query(consumerState('NO'));
    });

    await pmmTest.step('Start a session for Percona Server 8.4', async () => {
      await page.goto(queryAnalytics.url);
      await queryAnalytics.switchTab(queryAnalytics.tabNames.realTime);
      await rta.inputs.clusterService.click();
      await startSessionFromSelection(queryAnalytics, [percona84.service_id]);
    });

    await pmmTest.step('Verify the statement is listed with an elapsed time in whole seconds', async () => {
      await rta.setQueryTextFilter(queryLabel);

      void mySqlDbHelper.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });

      await expect(rta.builders.elapsedTimeForQueryByText(queryLabel)).toHaveText(/^\d\.000 s$/, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Verify the details MySQL does not measure show as Unavailable', async () => {
      await rta.builders.rowByQueryText(queryLabel).click();

      for (const value of [
        rta.elements.detailsRowsExamined,
        rta.elements.detailsRowsSent,
        rta.elements.detailsFullScan,
        rta.elements.detailsLockTime,
      ]) {
        await expect(value).toHaveText(rta.expectedTexts.unavailable);
      }
    });

    // A cluster's row sums up its services; the service's own row, under it, carries the status message.
    await pmmTest.step(
      'Verify the session status explains what is not collected and how to enable it',
      async () => {
        await rta.buttons.closeDetailsPane.click();
        await rta.buttons.allSessions.click();
        await rta.builders.sessionExpandButton(percona84.cluster).click();
        await rta.builders.sessionStatusMessage(percona84.service_name).hover();

        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          rta.expectedTexts.sessionWarningsIntro,
        );
        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          rta.expectedTexts.statementsConsumerDisabled,
        );
        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          rta.expectedTexts.consumerRemedy('events_statements_current'),
        );
      },
    );

    await pmmTest.step('Turn the consumer on, restart the session and verify it has no warning', async () => {
      await mySqlDbHelper.query(consumerState('YES'));
      await page.mouse.move(0, 0);
      await rta.builders.sessionStopButton(percona84.cluster).click();
      await rta.buttons.confirmStopSession.click();

      // With no session left, the Real-Time tab is back on the selection page.
      await expect(page).toHaveURL(queryAnalytics.rtaSelectionUrl);
      // eslint-disable-next-line playwright/no-wait-for-timeout -- a start within about a second of the stop leaves the session Down for good (MongoDB too); a person is never that fast
      await page.waitForTimeout(Timeouts.THREE_SECONDS);
      await rta.inputs.clusterService.click();
      await rta.selectServiceOptions([percona84.service_id]);
      await queryAnalytics.buttons.startSessionButton.click();

      await expect(page).not.toHaveURL(queryAnalytics.rtaSelectionUrl);

      await page.goto(queryAnalytics.rtaSessionsUrl);
      await rta.builders.sessionExpandButton(percona84.cluster).click();

      await expect(rta.builders.sessionStatus(percona84.service_name)).toHaveText(/^Running for /, {
        timeout: Timeouts.FIFTEEN_SECONDS,
      });
      await expect(rta.builders.sessionStatusMessage(percona84.service_name)).toHaveCount(0, {
        timeout: Timeouts.FIFTEEN_SECONDS,
      });
    });

    await pmmTest.step('Run the statement again and verify its details are measured', async () => {
      await rta.builders.sessionLink(percona84.service_name).click();
      await rta.setQueryTextFilter(queryLabel);

      // The first run may still be sleeping; one row keeps the click unambiguous.
      await expect(rta.builders.rowByQueryText(queryLabel)).toHaveCount(0, {
        timeout: Timeouts.THIRTY_SECONDS,
      });

      void mySqlDbHelper.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });
      await rta.builders.rowByQueryText(queryLabel).click({ timeout: Timeouts.TEN_SECONDS });

      await expect(rta.elements.detailsRowsExamined).toHaveText(/^\d+$/);
      await expect(rta.elements.detailsRowsSent).toHaveText(/^\d+$/);
      await expect(rta.elements.detailsFullScan).toHaveText(/^(Yes|No)$/);
      await expect(rta.elements.detailsLockTime).toHaveText(/^\d+(\.\d+)? ms$/);
    });
  },
);

pmmTest(
  'Verify the Lock time of a running MySQL statement is shown in milliseconds @rta',
  async ({ api, mySqlDbHelper, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-mysql-lock-time';
    const percona84 = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm_8_4_');

    await pmmTest.step('Open the live query table of a Percona Server 8.4 session', async () => {
      const response = await api.realTimeAnalyticsApi.startRealTimeAnalytics(percona84.service_id);

      expect(response.status(), await response.text()).toEqual(200);

      await page.goto(rta.getUrlWithServices([percona84.service_id]));
      await rta.setQueryTextFilter(queryLabel);
    });

    await pmmTest.step('Make the labelled statement wait 3 seconds for a row lock', async () => {
      await mySqlDbHelper.simulateLockTime(queryLabel, Timeouts.THREE_SECONDS);

      await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible();
    });

    const lockTimeMs = await pmmTest.step(
      'Verify the Details tab shows a Lock time of 2 to 5 seconds',
      async () => {
        // The row is read once the collector has seen the statement after it took the lock.
        await expect(rta.builders.blockedChipForQuery(queryLabel)).toHaveCount(0, {
          timeout: Timeouts.TEN_SECONDS,
        });
        await rta.builders.rowByQueryText(queryLabel).click();

        await expect(rta.elements.detailsLockTime).toHaveText(/^\d+(\.\d+)? ms$/);

        const lockTime = Number.parseFloat(await rta.elements.detailsLockTime.innerText());

        expect(lockTime).toBeGreaterThanOrEqual(2_000);
        expect(lockTime).toBeLessThanOrEqual(5_000);

        return lockTime;
      },
    );

    await pmmTest.step('Verify the raw lock latency in picoseconds matches the Lock time', async () => {
      await rta.buttons.detailsRawDataTab.click();

      await expect
        .poll(async () => {
          const { lock_latency } = JSON.parse(await rta.elements.detailsRawData.innerText()) as {
            lock_latency: number;
          };

          return Number((lock_latency / 1e9).toFixed(3));
        })
        .toEqual(lockTimeMs);
    });
  },
);

pmmTest(
  'Verify a MySQL statement cut short by MySQL is marked Truncated with a tooltip naming the setting to raise @rta',
  async ({ api, cliHelper, mySqlDbHelper, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const endMarker = 'rta-end-marker';
    const trailingValues = ['x'.repeat(1_900), endMarker];
    const percona84 = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm_8_4_');
    const longSqlText = await addRemoteMySql(
      api,
      cliHelper,
      'mysql-long-sql-text',
      'mysql:8.4 --performance-schema-max-sql-text-length=4096',
    );

    await pmmTest.step('Open the live query table of both services', async () => {
      for (const serviceId of [percona84.service_id, longSqlText.serviceId]) {
        const response = await api.realTimeAnalyticsApi.startRealTimeAnalytics(serviceId);

        expect(response.status(), await response.text()).toEqual(200);
      }

      await page.goto(rta.getUrlWithServices([percona84.service_id, longSqlText.serviceId]));
      await rta.setQueryTextFilter('rta-mysql-');
    });

    await pmmTest.step(
      'Verify a 2,000-byte statement on the default server is marked Truncated',
      async () => {
        void mySqlDbHelper.simulateLongRunningQuery({
          delayMs: Timeouts.THIRTY_SECONDS,
          queryLabel: 'rta-mysql-truncated',
          trailingValues,
        });

        await expect(rta.builders.truncatedChipForQuery('rta-mysql-truncated')).toHaveText('Truncated', {
          timeout: Timeouts.TEN_SECONDS,
        });

        await rta.builders.truncatedChipForQuery('rta-mysql-truncated').hover();

        await expect(rta.elements.tooltip).toHaveText(rta.expectedTexts.truncatedTooltip);
      },
    );

    await pmmTest.step(
      'Verify the details show the Truncated label and a statement cut before its end',
      async () => {
        await rta.builders.rowByQueryText('rta-mysql-truncated').click();

        await expect(rta.elements.detailsTruncatedChip).toHaveText('Truncated');
        await expect(rta.elements.detailsQueryText).toContainText('rta-mysql-truncated');
        await expect(rta.elements.detailsQueryText).not.toContainText(endMarker);

        await rta.buttons.closeDetailsPane.click();
      },
    );

    await pmmTest.step('Verify a short statement has no Truncated label', async () => {
      void mySqlDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.THIRTY_SECONDS,
        queryLabel: 'rta-mysql-short',
      });

      await expect(rta.builders.rowByQueryText('rta-mysql-short')).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(rta.builders.truncatedChipForQuery('rta-mysql-short')).toHaveCount(0);
    });

    await pmmTest.step(
      'Verify the same statement on a server with a raised limit is shown whole',
      async () => {
        void longSqlText.db.simulateLongRunningQuery({
          delayMs: Timeouts.THIRTY_SECONDS,
          queryLabel: 'rta-mysql-not-truncated',
          trailingValues,
        });

        await expect(rta.builders.rowByQueryText('rta-mysql-not-truncated')).toBeVisible({
          timeout: Timeouts.TEN_SECONDS,
        });
        await expect(rta.builders.truncatedChipForQuery('rta-mysql-not-truncated')).toHaveCount(0);

        await rta.builders.rowByQueryText('rta-mysql-not-truncated').click();

        await expect(rta.elements.detailsTruncatedChip).toHaveCount(0);
        await expect(rta.elements.detailsQueryText).toContainText(`'${endMarker}'`);
      },
    );
  },
);

pmmTest(
  "Verify Query Analytics keeps a MySQL service's queries but not Real-Time Analytics' own polling @rta",
  async ({
    agentsPage,
    api,
    cliHelper,
    credentials,
    mySqlDbHelper,
    page,
    qanStoredMetrics,
    queryAnalytics,
    urlHelper,
  }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-qan-independent';
    const slowLogServiceName = 'rta-qan-slowlog';
    const perfSchema = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm_8_4_');
    const [settings] = await mySqlDbHelper.query(
      'SELECT @@GLOBAL.slow_query_log AS slowQueryLog, @@GLOBAL.long_query_time AS longQueryTime',
    );

    mySqlRestores.push(
      `SET GLOBAL slow_query_log = ${settings.slowQueryLog}, GLOBAL long_query_time = ${settings.longQueryTime}`,
    );
    await mySqlDbHelper.query('SET GLOBAL slow_query_log = ON, GLOBAL long_query_time = 0');

    const slowLog = await pmmTest.step('Add a slow log service on the same Percona Server', async () => {
      cliHelper.removeService(perfSchema.node_name, ServiceType.mysql, slowLogServiceName);
      cliHelper
        .execute(
          `docker exec ${perfSchema.node_name} pmm-admin add mysql --query-source=slowlog --username=${credentials.perconaServer.username} --password=${credentials.perconaServer.password} --host=127.0.0.1 --port=3306 ${slowLogServiceName}`,
        )
        .assertSuccess();

      const service = await api.inventoryApi.getServiceDetailsByRegex(`^${slowLogServiceName}$`);

      serviceIds.push(service.service_id);

      return service;
    });

    await pmmTest.step('Start a session for both services', async () => {
      await page.goto(queryAnalytics.url);
      await queryAnalytics.switchTab(queryAnalytics.tabNames.realTime);
      await rta.inputs.clusterService.click();
      await startSessionFromSelection(
        queryAnalytics,
        [perfSchema, slowLog].map((service) => service.service_id),
      );
    });

    // Query Analytics stores a minute per bucket: from the next minute on, every SLEEP example is this test's.
    const windowStart = Math.ceil(Date.now() / Timeouts.ONE_MINUTE) * Timeouts.ONE_MINUTE;

    await pmmTest.step('Run the labelled statement four times and verify both services list it', async () => {
      await rta.setQueryTextFilter(queryLabel);
      // eslint-disable-next-line playwright/no-wait-for-timeout -- the examples checked below must come from this test's own minutes
      await page.waitForTimeout(windowStart - Date.now());

      // One connection: Performance Schema drops a closed connection's statement history, and the example with it.
      const connection = await mySqlDbHelper.connect();

      for (let run = 1; run <= 4; run++) {
        const statement = connection.query('SELECT ?, SLEEP(5)', [queryLabel]);

        for (const { service_name } of [perfSchema, slowLog]) {
          await expect(rta.builders.rowByQueryTextAndHost(queryLabel, service_name)).toBeVisible({
            timeout: Timeouts.FIVE_SECONDS,
          });
        }

        await statement;
      }
    });

    await pmmTest.step(
      'After 3 minutes, verify Stored metrics has no Real-Time Analytics polling query',
      async () => {
        // eslint-disable-next-line playwright/no-wait-for-timeout -- an absent query means something only after two collection windows
        await page.waitForTimeout(3 * Timeouts.ONE_MINUTE);
        await qanStoredMetrics.openAndWaitForReport(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
            from: 'now-15m',
            search: 'pmm_agent_rta',
            to: 'now',
          }),
        );

        await expect(qanStoredMetrics.inputs.search).toHaveValue('pmm_agent_rta');
        await expect(qanStoredMetrics.elements.noData).toBeVisible();
      },
    );

    for (const { service_name } of [perfSchema, slowLog]) {
      await pmmTest.step(`Verify the labelled statement is stored for ${service_name}`, async () => {
        await qanStoredMetrics.openQueryDetails(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
            from: String(windowStart),
            search: 'sleep',
            serviceName: service_name,
            to: 'now',
          }),
        );
        await qanStoredMetrics.openExamplesTab();

        await expect(qanStoredMetrics.elements.codeBlock).toContainText([queryLabel]);
      });
    }

    await pmmTest.step('Stop both sessions from All sessions', async () => {
      await page.goto(queryAnalytics.rtaSessionsUrl);
      await rta.stopAllSessions();

      for (const { cluster, service_name } of [perfSchema, slowLog]) {
        await expect(rta.builders.sessionRow(cluster || service_name)).toHaveCount(0);
      }
    });

    for (const [service, qanAgent] of [
      [perfSchema, 'QAN MySQL Performance Schema agent'],
      [slowLog, 'QAN MySQL Slow Query Log agent'],
    ] as const) {
      await pmmTest.step(`Verify the agents of ${service.service_name} keep running`, async () => {
        await page.goto(agentsPage.serviceAgentsUrl(service.service_id));

        await expect(agentsPage.builders.agentStatus(qanAgent)).toHaveText('Running');
        await expect(agentsPage.builders.agentStatus('MySQL exporter')).toHaveText('Running');
      });
    }
  },
);

pmmTest(
  'Verify MongoDB and MySQL sessions run side by side and each overview shows only its own technology @rta',
  async ({ api, mongoDbHelper, mySqlDbHelper, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-side-by-side';
    const mongoDb = await api.inventoryApi.getServiceDetailsByRegex('^rs101_');
    const mySql = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm_8_4_');
    const mongoDbSession = mongoDb.cluster || mongoDb.service_name;
    const mySqlSession = mySql.cluster || mySql.service_name;

    await pmmTest.step('Start rs101 and Percona Server 8.4 and verify both sessions are listed', async () => {
      await page.goto(queryAnalytics.url);
      await queryAnalytics.switchTab(queryAnalytics.tabNames.realTime);
      await rta.inputs.clusterService.click();
      await rta.selectServiceOptions([mongoDb.service_id, mySql.service_id]);
      await queryAnalytics.buttons.startSessionButton.click();

      await expect(rta.elements.sessionRows).toHaveCount(2);
      await expect(rta.builders.technologyForSession(mongoDbSession)).toHaveText('MongoDB');
      await expect(rta.builders.technologyForSession(mySqlSession)).toHaveText('MySQL');

      // A new session reads Unspecified until its agent reports, and the list polls every 5 seconds.
      for (const sessionName of [mongoDbSession, mySqlSession]) {
        await expect(rta.builders.sessionStatus(sessionName)).toHaveText(/^Running for /, {
          timeout: Timeouts.THIRTY_SECONDS,
        });
      }
    });

    void mongoDbHelper.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });
    void mySqlDbHelper.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });

    await pmmTest.step(
      'Open the MySQL session and verify only the MySQL statement and toggles show',
      async () => {
        await rta.builders.sessionLink(mySqlSession).click();
        await rta.setQueryTextFilter(queryLabel);

        await expect(rta.builders.hostForQueryByText(queryLabel)).toHaveText(mySql.service_name, {
          timeout: Timeouts.TEN_SECONDS,
        });
        await expect(rta.toggles.hideBeginCommit).toBeVisible();
        await expect(rta.toggles.blockedOnly).toBeVisible();
      },
    );

    await pmmTest.step('Verify rs101 cannot be added to the MySQL view', async () => {
      await rta.inputs.clusterService.click();

      await expect(rta.builders.serviceOption(mongoDb.service_id)).toHaveAttribute('aria-disabled', 'true');

      await page.keyboard.press('Escape');
    });

    await pmmTest.step('Open the rs101 session and verify only the MongoDB operation shows', async () => {
      await rta.buttons.allSessions.click();
      await rta.builders.sessionLink(mongoDbSession).click();
      await rta.setQueryTextFilter(queryLabel);

      await expect(rta.builders.hostForQueryByText(queryLabel)).toHaveText(mongoDb.service_name, {
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(rta.toggles.hideBeginCommit).toHaveCount(0);
      await expect(rta.toggles.blockedOnly).toHaveCount(0);
    });

    await rta.buttons.allSessions.click();
    await rta.stopAllSessions();
  },
);

pmmTest(
  'Verify Real-Time Analytics shows running statements of an Amazon RDS for MySQL service @rta',
  async ({ api, credentials, page, queryAnalytics }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- only Jenkins pmm3-ui-tests passes the QA RDS credentials
    pmmTest.skip(!credentials.rdsMysql84.address, 'Needs the QA RDS credentials (PMM_QA_MYSQL_RDS_8_4_*)');

    const { rta } = queryAnalytics;
    const queryLabel = 'rta-mysql-rds';
    const serviceName = `rta-rds-mysql-${Date.now()}`;
    const { service_id: serviceId } = (
      await api.managementApi.addRds({
        address: credentials.rdsMysql84.address,
        awsAccessKey: credentials.aws.accessKey,
        awsSecretKey: credentials.aws.secretKey,
        instanceId: serviceName,
        password: credentials.rdsMysql84.password,
        serviceName,
        username: credentials.rdsMysql84.username,
      })
    ).rds.mysql;
    const rds = new MySQLHelper({
      host: credentials.rdsMysql84.address,
      password: credentials.rdsMysql84.password,
      port: rdsPort,
      username: credentials.rdsMysql84.username,
    });

    serviceIds.push(serviceId);
    databases.push(rds);

    await pmmTest.step('Start a session for the RDS service', async () => {
      await page.goto(queryAnalytics.url);
      await queryAnalytics.switchTab(queryAnalytics.tabNames.realTime);
      await rta.inputs.clusterService.click();
      await startSessionFromSelection(queryAnalytics, [serviceId]);
    });

    await pmmTest.step(
      'Verify the labelled statement is listed within 5 seconds with the RDS host',
      async () => {
        await rta.setQueryTextFilter(queryLabel);

        void rds.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });

        await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible({ timeout: Timeouts.FIVE_SECONDS });
        await expect(rta.builders.hostForQueryByText(queryLabel)).toHaveText(serviceName);
      },
    );

    await pmmTest.step('Verify the details show the command, a state and the RDS user', async () => {
      await rta.builders.rowByQueryText(queryLabel).click();

      await expect(rta.elements.detailsCommand).toHaveText('Query');
      await expect(rta.elements.detailsState).not.toBeEmpty();
      await expect(rta.elements.detailsUsername).toContainText(credentials.rdsMysql84.username);
    });
  },
);
