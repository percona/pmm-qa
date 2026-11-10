import pmmTest from '@fixtures/pmmTest';
import { getServiceContainer } from '@helpers/frameworkServices.helper';
import { serviceConnections, testDatabase, testUser } from '@helpers/serviceConnection.helper';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus, GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

for (const {
  agentPasswordEnforced,
  createUser,
  dropUser,
  exporterType,
  hasDatabase,
  name,
  original,
  serviceRegex,
} of serviceConnections) {
  pmmTest.describe(`Edit service connection | ${name}`, () => {
    let service: GetService;
    let container: string;

    pmmTest.beforeEach(async ({ api, cliHelper, credentials, dockerHelper, grafanaHelper }) => {
      await grafanaHelper.authorize();
      service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
      container = await getServiceContainer(api, dockerHelper, service);
      cliHelper.execSilent(dropUser(container, credentials));
      cliHelper.execSilent(createUser(container, credentials)).assertSuccess();
    });

    pmmTest.afterEach(async ({ api, cliHelper, credentials }) => {
      const { agentPassword, password, username } = original(credentials);

      try {
        const exporter = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);

        // Without a custom agent password the exporter's endpoint takes its agent ID.
        await api.inventoryApi.updateService(service.service_id, service.service_type, {
          agent_password: agentPassword ?? exporter.agent_id,
          password,
          username,
          ...(hasDatabase && { database: service.database_name }),
        });
      } finally {
        cliHelper.execSilent(dropUser(container, credentials)).assertSuccess();
      }
    });

    pmmTest(
      `PMM-15674 - Verify Connection section shows the current settings and hides passwords for ${name} service @inventory`,
      async ({ api, editServicePage }) => {
        const exporter = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);

        await editServicePage.open(service.service_id);
        await editServicePage.verifyConnection({
          database: hasDatabase ? service.database_name : undefined,
          username: exporter.username,
        });
        await expect(editServicePage.inputs.database).toBeVisible({ visible: !!hasDatabase });
        await expect(editServicePage.buttons.saveChanges).toBeDisabled();
      },
    );

    pmmTest(
      `PMM-15674 - Verify changing database, username, password and agent password of ${name} service @inventory`,
      async ({ api, dockerHelper, editServicePage }) => {
        const connection = { ...testUser, database: hasDatabase ? testDatabase : undefined };

        await editServicePage.open(service.service_id);
        await editServicePage.editConnection(connection);

        const response = await editServicePage.saveChanges(service.service_id);

        await editServicePage.expectSaved(response);
        await expect(editServicePage.builders.successMessage(service.service_name)).toBeVisible();

        await expect
          .poll(
            async () => {
              const { database_name } = await api.inventoryApi.getServiceById(service.service_id);
              const { is_agent_password_set, status, username } = await api.inventoryApi.getServiceExporter(
                service.service_id,
                exporterType,
              );

              return { database_name, is_agent_password_set, status, username };
            },
            { message: `${exporterType} after connection edit`, timeout: Timeouts.ONE_MINUTE },
          )
          .toEqual({
            database_name: hasDatabase ? testDatabase : service.database_name,
            is_agent_password_set: true,
            status: AgentStatus.running,
            username: testUser.username,
          });

        const { listen_port } = await api.inventoryApi.getServiceExporter(service.service_id, exporterType);
        const metricsStatus = (agentPassword: string) =>
          dockerHelper.getHttpStatus(
            container,
            `http://pmm:${agentPassword}@127.0.0.1:${listen_port}/metrics`,
          );

        // The exporter picks up the new agent password only once pmm-agent has restarted it. One without
        // basic auth answers 200 before the restart too, so the next request can still find its port closed.
        await expect
          .poll(() => metricsStatus(testUser.agentPassword), {
            message: 'exporter accepts the new agent password',
            timeout: Timeouts.ONE_MINUTE,
          })
          .toEqual('200');
        await expect
          .poll(() => metricsStatus('wrong-agent-password'), {
            message: 'exporter rejects another agent password',
            timeout: Timeouts.ONE_MINUTE,
          })
          .toEqual(agentPasswordEnforced ? '401' : '200');

        await editServicePage.open(service.service_id);
        await editServicePage.verifyConnection(connection);
      },
    );

    pmmTest(
      `PMM-15674 - Verify wrong password is rejected by the connection check for ${name} service @inventory`,
      async ({ api, credentials, editServicePage }) => {
        const { username } = original(credentials);

        await editServicePage.open(service.service_id);
        await editServicePage.editConnection({ password: 'wrong-password', username: testUser.username });

        const response = await editServicePage.saveChanges(service.service_id);

        await editServicePage.expectRefused(
          response,
          service.service_id,
          'connection check fails with a wrong password',
        );
        expect(
          (await api.inventoryApi.getServiceExporter(service.service_id, exporterType)).username,
          'stored username is unchanged',
        ).toEqual(username);
      },
    );
  });
}
