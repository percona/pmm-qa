import { readFile } from 'node:fs/promises';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { GetService, InventoryAgent } from '@interfaces/inventory';
import { expect } from '@playwright/test';

let service: GetService;
// pmm-framework names a service after its container, plus a random suffix.
const containerOf = (serviceName: string) => serviceName.replace(/_\d+$/, '');
// export-to-csv quotes strings but not numbers or booleans.
const parseCsvLine = (line: string) =>
  Array.from(line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g), ([, quoted, plain]) =>
    quoted === undefined ? plain : quoted.replaceAll('""', '"'),
  );

pmmTest.beforeEach(async ({ api, grafanaHelper, page, queryAnalytics }) => {
  await grafanaHelper.authorize();

  // pmm-framework's pdpgsql registers the same node over TCP and, as socket_pdpgsql_pmm_*, over its socket.
  service = await api.inventoryApi.getServiceDetailsByRegexAndParameters('^pdpgsql_pmm_', {});
  await api.realTimeAnalyticsApi.startRealTimeAnalytics(service.service_id);
  await page.goto(queryAnalytics.rta.getUrlWithServices([service.service_id]));
});

pmmTest.afterEach(async ({ api }) => {
  await api.realTimeAnalyticsApi.stopRealTimeAnalytics(service.service_id);
});

pmmTest(
  'Verify RTA overview shows running PostgreSQL queries with host, pid, database and user @rta',
  async ({ postgreSqlDbHelper, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-pg-overview';
    const pid = await postgreSqlDbHelper.simulateLongRunningQuery({
      delayMs: Timeouts.THIRTY_SECONDS,
      queryLabel,
    });

    await pmmTest.step('Pause RTA on the running query and filter the list', async () => {
      await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await rta.buttons.pauseRealTimeAnalytics.click();
      await rta.filterQueriesByText(queryLabel);
    });

    await pmmTest.step('Verify the row names the service and the backend pid', async () => {
      await expect(rta.builders.hostForRow('1')).toHaveText(service.service_name);
      await expect(rta.builders.operationIdForRow('1')).toHaveText(String(pid));
    });

    await pmmTest.step('Verify Database and User are hidden by default and can be revealed', async () => {
      await expect(rta.elements.databaseColumnHeader).toBeHidden();
      await expect(rta.elements.userColumnHeader).toBeHidden();

      await rta.showColumns('Database', 'User');

      await expect(rta.builders.databaseForRow('1')).toHaveText('postgres');
      await expect(rta.builders.userForRow('1')).toHaveText('postgres');
    });
  },
);

pmmTest(
  'Verify PostgreSQL query details show session attributes, query ID and the raw pg_stat_activity row @rta',
  async ({ postgreSqlDbHelper, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-pg-details';
    const pid = await postgreSqlDbHelper.simulateLongRunningQuery({
      computeQueryId: true,
      delayMs: Timeouts.THIRTY_SECONDS,
      queryLabel,
    });
    const queryId = await postgreSqlDbHelper.queryIdOf(pid);

    await pmmTest.step('Pause RTA and open details for the query', async () => {
      await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await rta.buttons.pauseRealTimeAnalytics.click();
      await rta.filterQueriesByText(queryLabel);
      await rta.openDetailsForRow('1');
    });

    await pmmTest.step('Verify PostgreSQL session attributes', async () => {
      await expect(rta.builders.detailsPaneCodeByText(queryLabel)).toBeVisible();
      await expect(rta.elements.detailsOperationId).toHaveText(String(pid));
      await expect(rta.elements.detailsDbInstanceAddress).toHaveText('127.0.0.1:5432');
      await expect(rta.elements.detailsDatabaseName).toHaveText('postgres');
      await expect(rta.elements.detailsUsername).toHaveText('postgres');
      await expect(rta.elements.detailsState).toHaveText('active');
      await expect(rta.elements.detailsWaitEvent).toHaveText('Timeout: PgSleep');
      await expect(rta.elements.detailsClientAppName).toHaveText(postgreSqlDbHelper.applicationName);
      await expect(rta.elements.detailsOperationStartTime).not.toBeEmpty();
      await expect(rta.elements.detailsTransactionStartTime).not.toBeEmpty();
    });

    await pmmTest.step('Verify Query ID matches the one PostgreSQL computed', async () => {
      await expect(rta.elements.detailsQueryId).toHaveText(queryId);
    });

    await pmmTest.step('Verify raw data shows the pg_stat_activity row', async () => {
      await rta.buttons.detailsRawDataTab.click();

      await expect(rta.elements.detailsRawData).toContainText(queryLabel);
      await expect(rta.elements.detailsRawData).toContainText('backend_type');
      await expect(rta.elements.detailsRawData).toContainText('client backend');
    });
  },
);

pmmTest(
  'Verify a PostgreSQL session idle in transaction is marked and timed from its transaction start @rta',
  async ({ postgreSqlDbHelper, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-pg-idle-in-transaction';
    const openForSeconds = 10;
    const pid = await postgreSqlDbHelper.holdIdleTransaction(queryLabel, openForSeconds * 1_000);

    await pmmTest.step('Verify the session is marked idle in transaction', async () => {
      await expect(rta.builders.idleInTransactionChipForQuery(queryLabel)).toHaveText('idle in transaction', {
        timeout: Timeouts.TEN_SECONDS,
      });
      await rta.buttons.pauseRealTimeAnalytics.click();
      await rta.filterQueriesByText(queryLabel);
    });

    await pmmTest.step('Verify elapsed time counts from BEGIN, not from the last statement', async () => {
      expect(await rta.getElapsedTimeForQueryByText(queryLabel)).toBeGreaterThanOrEqual(openForSeconds);
    });

    await pmmTest.step('Verify the details pane shows the idle session', async () => {
      await rta.openDetailsForRow('1');

      await expect(rta.elements.detailsOperationId).toHaveText(String(pid));
      await expect(rta.elements.detailsState).toHaveText('idle in transaction');
      await expect(rta.elements.detailsWaitEvent).toHaveText('Client: ClientRead');
    });
  },
);

pmmTest(
  'Verify a PostgreSQL row-lock chain names the holder as root and the queue ahead @rta',
  async ({ postgreSqlDbHelper, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-pg-row-lock';
    const holderText = `${queryLabel}-holder`;
    const firstWaiterText = `${queryLabel}-waiter-1`;
    const secondWaiterText = `${queryLabel}-waiter-2`;
    const {
      holder,
      waiters: [firstWaiter],
    } = await postgreSqlDbHelper.simulateRowLockChain(queryLabel);

    await pmmTest.step('Pause RTA once the second waiter is blocked', async () => {
      await expect(rta.builders.blockedChipForQuery(secondWaiterText)).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
      await rta.buttons.pauseRealTimeAnalytics.click();
      await rta.filterQueriesByText(queryLabel);

      await expect(rta.elements.realTimeTableRow).toHaveCount(3);
    });

    await pmmTest.step('Verify the holder is idle in transaction and both waiters name it', async () => {
      await expect(rta.builders.idleInTransactionChipForQuery(holderText)).toHaveText('idle in transaction');
      await expect(rta.builders.blockedChipForQuery(holderText)).toHaveCount(0);
      await expect(rta.builders.blockedChipForQuery(firstWaiterText)).toHaveText(`Blocked by ${holder}`);
      await expect(rta.builders.blockedChipForQuery(secondWaiterText)).toHaveText(`Blocked by ${holder}`);
      await expect(rta.toggles.blockedOnly).toHaveText('Blocked only (2)');
    });

    await pmmTest.step('Verify the second waiter lists the first one queued ahead of it', async () => {
      await rta.builders.rowByQueryText(secondWaiterText).click();

      await expect(rta.elements.blockedByHeading).toHaveText(`Blocked by ${holder}`);
      await expect(rta.elements.blockedWaitDuration).toContainText('waiting');
      await expect(rta.elements.blockerQuery).toContainText(holderText);
      await expect(rta.elements.blockedByPanel).toContainText('idle in transaction');
      await expect(rta.elements.blockedByPanel).toContainText('1 more transaction ahead');
      await expect(rta.elements.blockedByPanel).toContainText(String(firstWaiter));
      await expect(rta.elements.blockedByPanel).toContainText(`Resolving conn ${holder}`);
      await rta.buttons.closeDetailsPane.click();
    });

    await pmmTest.step('Verify Blocked only hides the holder', async () => {
      await rta.toggles.blockedOnly.click();

      await expect(rta.elements.realTimeTableRow).toHaveCount(2);
      await expect(rta.builders.rowByQueryText(holderText)).toHaveCount(0);
    });
  },
);

pmmTest(
  'Verify an advisory-lock wait on an idle PostgreSQL session explains the session-level lock @rta',
  async ({ postgreSqlDbHelper, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-pg-advisory-lock';
    const { holder } = await postgreSqlDbHelper.simulateAdvisoryLockWait(queryLabel, 15_167);

    await pmmTest.step('Pause RTA on the waiting query', async () => {
      await expect(rta.builders.blockedChipForQuery(queryLabel)).toHaveText(`Blocked by ${holder}`, {
        timeout: Timeouts.TEN_SECONDS,
      });
      await rta.buttons.pauseRealTimeAnalytics.click();
      await rta.filterQueriesByText(queryLabel);
    });

    await pmmTest.step('Verify the Blocked by panel explains how to release the lock', async () => {
      await rta.openDetailsForRow('1');

      await expect(rta.elements.blockedByHeading).toHaveText(`Blocked by ${holder}`);
      await expect(rta.elements.blockerQuery).toContainText('pg_advisory_lock');
      await expect(rta.elements.blockedByPanel).toContainText('Not executing anything right now');
      await expect(rta.elements.blockedByPanel).toContainText('session-level');
      await expect(rta.elements.blockedByPanel).toContainText('pg_advisory_unlock()');
    });
  },
);

pmmTest(
  'Verify the Truncated chip marks a query cut at track_activity_query_size @rta',
  async ({ postgreSqlDbHelper, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-pg-truncated';
    const shortQueryLabel = 'rta-pg-short';
    const querySize = await postgreSqlDbHelper.trackActivityQuerySize();

    await pmmTest.step('Run a query longer than track_activity_query_size and a short one', async () => {
      await postgreSqlDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.THIRTY_SECONDS,
        minLength: querySize + 100,
        queryLabel,
      });
      await postgreSqlDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.THIRTY_SECONDS,
        queryLabel: shortQueryLabel,
      });

      await expect(rta.builders.truncatedChipForQuery(queryLabel)).toHaveText('Truncated', {
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(rta.builders.rowByQueryText(shortQueryLabel)).toBeVisible();
      await rta.buttons.pauseRealTimeAnalytics.click();
    });

    await pmmTest.step('Verify only the long query is marked', async () => {
      await expect(rta.builders.truncatedChipForQuery(shortQueryLabel)).toHaveCount(0);
    });

    await pmmTest.step('Verify the tooltip names the setting and the restart it needs', async () => {
      await rta.builders.truncatedChipForQuery(queryLabel).hover();

      await expect(rta.elements.tooltip).toContainText('track_activity_query_size');
      await expect(rta.elements.tooltip).toContainText('restart');
    });

    await pmmTest.step('Verify the details pane marks the query text as truncated', async () => {
      await rta.filterQueriesByText(queryLabel);
      await rta.openDetailsForRow('1');

      await expect(rta.elements.detailsQueryTextTruncated).toBeVisible();
    });
  },
);

pmmTest(
  'Verify PostgreSQL parallel workers are folded into their leader @rta',
  async ({ postgreSqlDbHelper, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-pg-parallel';
    const leader = await postgreSqlDbHelper.simulateParallelQuery(queryLabel);

    await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    await rta.buttons.pauseRealTimeAnalytics.click();

    await expect(rta.builders.rowByQueryText(queryLabel)).toHaveCount(1);
    await expect(rta.builders.operationIdForQueryByText(queryLabel)).toHaveText(String(leader));
  },
);

pmmTest(
  'Verify RTA runs for a PostgreSQL service monitored over its Unix socket @rta',
  async ({ api, page, postgreSqlDbHelper, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-pg-socket';
    const socketService = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
      '^socket_pdpgsql_pmm_',
      {},
    );

    try {
      await pmmTest.step('Start a session for the socket service', async () => {
        const response = await api.realTimeAnalyticsApi.startRealTimeAnalytics(socketService.service_id);

        expect(response.status(), await response.text()).toBe(200);
        await page.goto(rta.getUrlWithServices([socketService.service_id]));
        await postgreSqlDbHelper.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });
      });

      await pmmTest.step('Verify the query is listed with the socket directory as its instance', async () => {
        await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
        await rta.buttons.pauseRealTimeAnalytics.click();
        await rta.filterQueriesByText(queryLabel);

        await expect(rta.builders.hostForRow('1')).toHaveText(socketService.service_name);

        await rta.openDetailsForRow('1');

        await expect(rta.elements.detailsDbInstanceAddress).toHaveText('/var/run/postgresql');
      });
    } finally {
      await api.realTimeAnalyticsApi.stopRealTimeAnalytics(socketService.service_id);
    }
  },
);

pmmTest(
  "Verify PMM Server's own PostgreSQL is neither offered nor started for RTA @rta",
  async ({ api, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const ownDatabase = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
      '^pmm-server-postgresql$',
      {},
    );

    await pmmTest.step('Verify the RTA services API lists only the monitored PostgreSQL', async () => {
      const serviceIds = ((await api.realTimeAnalyticsApi.listServices()).postgresql ?? []).map(
        ({ service_id }) => service_id,
      );

      expect(serviceIds).toContain(service.service_id);
      expect(serviceIds).not.toContain(ownDatabase.service_id);
    });

    await pmmTest.step('Verify a session for it is refused', async () => {
      const response = await api.realTimeAnalyticsApi.startRealTimeAnalytics(ownDatabase.service_id);

      expect(response.status()).toBe(400);
      expect(await response.text()).toContain("not available for PMM Server's own database");
    });

    await pmmTest.step('Verify the new session picker offers PostgreSQL without it', async () => {
      await page.goto(rta.sessionsUrl);
      await rta.buttons.openNewSessionModal.click();

      await expect(rta.elements.newSessionModal).toContainText('PostgreSQL');

      await rta.elements.newSessionModal.locator(rta.inputs.realTimeServiceInput).click();

      await expect(rta.builders.technologyGroupHeader('PostgreSQL')).toBeVisible();
      await expect(rta.builders.serviceOption(service.service_id)).toBeVisible();
      await expect(
        rta.elements.servicesListbox.getByText(ownDatabase.service_name, { exact: true }),
      ).toHaveCount(0);
    });
  },
);

pmmTest(
  'Verify a PostgreSQL RTA session runs an rta_postgresql_agent listed by the inventory API and pmm-admin @rta',
  async ({ api, cliHelper }) => {
    const rtaAgent = await pmmTest.step('Verify the inventory API lists a running agent', async () => {
      let agent: InventoryAgent | undefined;

      await expect
        .poll(
          async () => {
            agent = (await api.inventoryApi.getAgents()).rta_postgresql_agent?.find(
              ({ service_id }) => service_id === service.service_id,
            );

            return agent?.status;
          },
          { timeout: Timeouts.ONE_MINUTE },
        )
        .toBe('AGENT_STATUS_RUNNING');

      return agent as InventoryAgent;
    });

    for (const command of ['pmm-admin list', 'pmm-admin inventory list agents']) {
      await pmmTest.step(`Verify ${command} shows it running`, async () => {
        await expect
          .poll(
            () =>
              cliHelper
                .execSilent(`docker exec ${containerOf(service.service_name)} ${command}`)
                .getStdOutLines()
                .find((line) => line.includes(rtaAgent.agent_id)) ?? '',
            { timeout: Timeouts.THIRTY_SECONDS },
          )
          .toMatch(/rta_postgresql_agent\s+Running/);
      });
    }
  },
);

pmmTest(
  'Verify the Inventory lists the PostgreSQL RTA agent and keeps the service OK after the session stops @rta',
  async ({ agentsPage, api, page, servicesPage }) => {
    const rtaAgentStatus = await pmmTest.step('Open the agents of the service', async () => {
      let agentId = '';

      await expect
        .poll(
          async () => {
            agentId =
              (await api.inventoryApi.getAgents()).rta_postgresql_agent?.find(
                ({ service_id }) => service_id === service.service_id,
              )?.agent_id ?? '';

            return agentId;
          },
          { timeout: Timeouts.ONE_MINUTE },
        )
        .not.toBe('');
      await page.goto(agentsPage.serviceAgentsUrl(service.service_id));

      return agentsPage.elements.agentRows.filter({ hasText: agentId }).getByTestId('agent-status-chip');
    });

    await pmmTest.step('Verify the agent runs while the session does', async () => {
      await expect(async () => {
        await page.reload();
        await expect(rtaAgentStatus).toHaveText('Running', { timeout: Timeouts.FIVE_SECONDS });
      }).toPass({ timeout: Timeouts.THIRTY_SECONDS });
    });

    await pmmTest.step('Stop the session and verify the agent is done', async () => {
      await api.realTimeAnalyticsApi.stopRealTimeAnalytics(service.service_id);

      await expect(async () => {
        await page.reload();
        await expect(rtaAgentStatus).toHaveText('Done', { timeout: Timeouts.FIVE_SECONDS });
      }).toPass({ timeout: Timeouts.THIRTY_SECONDS });
    });

    await pmmTest.step('Verify the stopped RTA agent does not degrade the monitoring status', async () => {
      await page.goto(servicesPage.url);
      await servicesPage.verifyServiceMonitoringStatusOk(service.service_name);
    });
  },
);

pmmTest(
  'Verify the sessions list names PostgreSQL in the Technology column @rta',
  async ({ page, queryAnalytics }) => {
    await page.goto(queryAnalytics.rta.sessionsUrl);

    await expect(queryAnalytics.rta.elements.technologyColumnHeader).toBeVisible({
      timeout: Timeouts.TEN_SECONDS,
    });
    await expect(queryAnalytics.rta.builders.technologyForSession(service.service_name)).toHaveText(
      'PostgreSQL',
    );
  },
);

pmmTest(
  'Verify a monitoring user outside pg_read_all_stats gets an actionable session warning @rta',
  async ({ api, page, postgreSqlDbHelper, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const role = 'rta_qa_limited';
    const serviceName = `rta_pg_limited_${Math.floor(Math.random() * 10_000)}`;
    const exporter = service.agents.find(({ agent_type }) => agent_type === 'postgres_exporter');
    let limitedServiceId = '';

    try {
      await pmmTest.step('Monitor the instance as a user without pg_read_all_stats', async () => {
        expect(exporter, `${service.service_name} must have a postgres_exporter`).toBeDefined();
        await postgreSqlDbHelper.createLoginRole(role, role);

        const { postgresql } = await api.managementApi.addService({
          postgresql: {
            address: '127.0.0.1',
            node_id: service.node_id,
            password: role,
            pmm_agent_id: exporter?.pmm_agent_id,
            port: 5_432,
            service_name: serviceName,
            username: role,
          },
        });

        limitedServiceId = postgresql?.service.service_id ?? '';

        const response = await api.realTimeAnalyticsApi.startRealTimeAnalytics(limitedServiceId);

        expect(response.status(), await response.text()).toBe(200);
      });

      await pmmTest.step('Verify the running session says which grant is missing', async () => {
        await page.goto(rta.sessionsUrl);
        await expect(async () => {
          await page.reload();
          await expect(rta.builders.sessionStatusMessageFor(serviceName)).toBeVisible({
            timeout: Timeouts.FIVE_SECONDS,
          });
        }).toPass({ timeout: Timeouts.ONE_MINUTE });
        await rta.builders.sessionStatusMessageFor(serviceName).hover();

        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          'The session is running, but some details cannot be collected from this instance:',
        );
        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          'not a member of pg_read_all_stats',
        );
        await expect(rta.elements.sessionStatusMessageTooltip).toContainText(
          'Grant it pg_monitor or pg_read_all_stats.',
        );
      });
    } finally {
      if (limitedServiceId) {
        await api.realTimeAnalyticsApi.stopRealTimeAnalytics(limitedServiceId);
        await api.managementApi.removeService(limitedServiceId);
      }

      await postgreSqlDbHelper.dropRole(role);
    }
  },
);

pmmTest(
  'Verify Blocked only is offered for PostgreSQL and keeps undecided sessions, without Hide BEGIN/COMMIT @rta',
  async ({ mocks, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const blockedQuery = 'UPDATE pgbench_accounts SET abalance = abalance + 1 WHERE aid = 7';
    const runningQuery = 'SELECT abalance FROM pgbench_accounts WHERE aid = 8';
    const undecidedQuery = 'DELETE FROM pgbench_history WHERE aid = 9';

    await pmmTest.step('Mock blocked, running, undecided and idle-in-transaction sessions', async () => {
      await mocks.mockRealTimeAnalyticsQueries([
        {
          postgreSqlPayload: {
            blocked_by: [
              {
                blocker_transaction_duration: '42s',
                blocking_command: 'idle in transaction',
                blocking_conn_id: '4100',
                blocking_query: 'UPDATE pgbench_accounts SET abalance = 0 WHERE aid = 7',
                blocking_username: 'app',
                root: true,
                wait_duration: '3s',
              },
            ],
            blocked_status: 'BLOCKED_STATUS_BLOCKED',
            wait_event: 'transactionid',
            wait_event_type: 'Lock',
          },
          queryId: '4101',
          queryText: blockedQuery,
        },
        { postgreSqlPayload: {}, queryId: '4102', queryText: runningQuery },
        {
          postgreSqlPayload: {
            blocked_status: 'BLOCKED_STATUS_UNSPECIFIED',
            wait_event: 'tuple',
            wait_event_type: 'Lock',
          },
          queryId: '4103',
          queryText: undecidedQuery,
        },
        { postgreSqlPayload: { state: 'idle in transaction' }, queryId: '4104', queryText: 'BEGIN' },
      ]);
      await page.reload();

      await expect(rta.elements.realTimeTableRow).toHaveCount(4, { timeout: Timeouts.TEN_SECONDS });
      await rta.buttons.pauseRealTimeAnalytics.click();
    });

    await pmmTest.step('Verify the chips and toggles offered for PostgreSQL', async () => {
      await expect(rta.builders.blockedChipForQuery(blockedQuery)).toHaveText('Blocked by 4100');
      await expect(rta.builders.blockedChipForQuery(runningQuery)).toHaveCount(0);
      await expect(rta.builders.idleInTransactionChipForQuery('BEGIN')).toHaveText('idle in transaction');
      await expect(rta.toggles.blockedOnly).toHaveText('Blocked only (1)');
      await expect(rta.toggles.hideBeginCommit).toHaveCount(0);
    });

    await pmmTest.step('Enable Blocked only and verify blocked and undecided sessions stay', async () => {
      await rta.toggles.blockedOnly.click();

      await expect(rta.elements.realTimeTableRow).toHaveCount(2);
      await expect(rta.builders.rowByQueryText(blockedQuery)).toBeVisible();
      await expect(rta.builders.rowByQueryText(undecidedQuery)).toBeVisible();
    });

    await pmmTest.step('Verify the details pane names the idle blocker', async () => {
      await rta.builders.rowByQueryText(blockedQuery).click();

      await expect(rta.elements.blockedByHeading).toHaveText('Blocked by 4100');
      await expect(rta.elements.blockerQuery).toContainText('SET abalance = 0');
      await expect(rta.elements.blockedByPanel).toContainText('idle in transaction');
      await expect(rta.elements.blockedByPanel).toContainText('Resolving conn 4100');
      await expect(rta.elements.detailsWaitEvent).toHaveText('Lock: transactionid');
    });
  },
);

pmmTest(
  'Verify the overview picker groups PostgreSQL and refuses to mix technologies @rta',
  async ({ mocks, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;

    await mocks.mockRealTimeAnalyticsSessionsOf([
      { serviceId: 'mock-postgresql-service', serviceType: 'SERVICE_TYPE_POSTGRESQL_SERVICE' },
      { serviceId: 'mock-mysql-service', serviceType: 'SERVICE_TYPE_MYSQL_SERVICE' },
      { serviceId: 'mock-mongo-service', serviceType: 'SERVICE_TYPE_MONGODB_SERVICE' },
    ]);
    await page.goto(rta.getUrlWithServices(['mock-postgresql-service']));
    await rta.buttons.openServices.click();

    await expect(rta.builders.serviceOption('mock-postgresql-service')).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(rta.builders.serviceOption('mock-mysql-service')).toHaveAttribute('aria-disabled', 'true');
    await expect(rta.builders.serviceOption('mock-mongo-service')).toHaveAttribute('aria-disabled', 'true');
    await expect(rta.builders.technologyGroupHeader('PostgreSQL')).toBeVisible();
  },
);

pmmTest(
  'Verify RTA CSV export of PostgreSQL sessions is named for PostgreSQL and keeps the pid as operation_id @rta',
  async ({ mocks, page, queryAnalytics }, testInfo) => {
    const { rta } = queryAnalytics;
    const pid = '4242';

    await mocks.mockRealTimeAnalyticsQueries([
      {
        postgreSqlPayload: {
          query_text_truncated: true,
          wait_event: 'transactionid',
          wait_event_type: 'Lock',
        },
        queryId: pid,
        queryText: 'UPDATE pgbench_accounts SET abalance = abalance + 1 WHERE aid = 42',
      },
    ]);
    await page.reload();

    await expect(rta.elements.realTimeTableRow).toHaveCount(1, { timeout: Timeouts.TEN_SECONDS });
    await rta.buttons.pauseRealTimeAnalytics.click();

    const downloadPromise = page.waitForEvent('download');

    await rta.buttons.export.click();

    const download = await downloadPromise;
    const csvPath = testInfo.outputPath(download.suggestedFilename());

    expect(download.suggestedFilename()).toMatch(/^postgresql_rta_export_\d{8}_\d{6}\.csv$/);

    await download.saveAs(csvPath);

    const [headers, values] = (await readFile(csvPath, 'utf8')).trim().split(/\r?\n/).map(parseCsvLine);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));

    expect(headers).toEqual(
      expect.arrayContaining(['blocked_status', 'query_start_time', 'transaction_start_time']),
    );
    expect(row).toMatchObject({
      application_name: 'pgbench',
      database_name: 'pgbench',
      operation_id: pid,
      pg_query_id: '-6094915464410306043',
      pid,
      query_text_truncated: 'true',
      state: 'active',
      user_name: 'pgbench',
      wait_event: 'transactionid',
      wait_event_type: 'Lock',
    });
  },
);
