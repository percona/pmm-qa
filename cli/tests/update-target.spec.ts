import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';
import { clientCredentialsFlags } from '@helpers/constants';

// No other spec adds Services on rs102, which has to hold only the Service of the pmm-framework setup.
const containerName = 'rs102';
const replIpPort = 'rs102:27017';

test.describe('PSMDB pmm-admin update target selection', { tag: '@psmdb' }, () => {
  test.use({ pmmClientContainer: containerName });

  const ownServiceName = 'mongo_update_target_cli';
  let setupService: pmmAdmin.ListService;
  let setupEnvironment: string;

  const mongoServices = async () => (await pmmAdmin.listServices(containerName)).filter((service) => /mongodb/i.test(service.service_type));
  const environmentOf = async (serviceId: string) => ((await pmmApi.getServerService(serviceId)).environment as string | undefined) ?? '';

  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB rs102 docker container should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=pss');

    const services = await mongoServices();
    expect(services, 'The Node should have the one MongoDB Service of the pmm-framework setup').toHaveLength(1);
    [setupService] = services;
    setupEnvironment = await environmentOf(setupService.service_id);
  });

  test.afterEach(async ({}, testInfo) => {
    // A version-gated test is skipped after its fixtures ran, and afterEach still runs for it.
    if (testInfo.status === 'skipped') return;

    await pmmCli.runEach([
      async () => {
        await (await cli.exec(`docker exec ${containerName} pmm-admin remove mongodb ${ownServiceName} || true`)).assertSuccess();
      },
      async () => {
        await pmmAdmin.updateServiceOk(containerName, 'mongodb', `--service-id=${setupService.service_id} --environment=${setupEnvironment}`);
      },
    ]);
  });

  test('PMM-T2738 - Verify pmm-admin update changes the only Service of its type on the Node when no name is given', async ({}) => {
    const output = await pmmAdmin.updateServiceOk(containerName, 'mongodb', '--environment=implicit_target');

    expect(output.stdout).toContain(`Service ID  : ${setupService.service_id}`);
    expect(output.stdout).toContain(`Service name: ${setupService.service_name}`);
    expect(pmmAdmin.getChangedSettings(output)).toEqual([`--environment=implicit_target (was ${setupEnvironment || 'empty'})`]);
    expect(await environmentOf(setupService.service_id), 'Environment is not changed on PMM Server').toEqual('implicit_target');
  });

  test('PMM-T2739 - Verify pmm-admin update --service-id selects the Service to change', async ({}) => {
    const output = await pmmAdmin.updateServiceOk(containerName, 'mongodb', `--service-id=${setupService.service_id} --environment=by_service_id`);

    expect(output.stdout).toContain(`Service ID  : ${setupService.service_id}`);
    expect(output.stdout).toContain(`Service name: ${setupService.service_name}`);
    expect(pmmAdmin.getChangedSettings(output)).toEqual([`--environment=by_service_id (was ${setupEnvironment || 'empty'})`]);
    expect(await environmentOf(setupService.service_id), 'Environment is not changed on PMM Server').toEqual('by_service_id');
  });

  test('PMM-T2740 - Verify pmm-admin update refuses to pick a Service when the Node has none or several of the type', async ({}) => {
    const none = await pmmAdmin.updateService(containerName, 'proxysql', '--environment=no_service');
    await cli.expectFailure(none, 'found 0 Services of this type on this Node; pass the Service name or --service-id');

    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} ${ownServiceName} ${replIpPort}`);
    await output.assertSuccess();

    const several = await pmmAdmin.updateService(containerName, 'mongodb', '--environment=several_services');
    await cli.expectFailure(several, 'found 2 Services of this type on this Node; pass the Service name or --service-id');
    expect(await environmentOf(setupService.service_id), 'Environment changed by a refused update').toEqual(setupEnvironment);
  });
});
