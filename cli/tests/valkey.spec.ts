import { expect, test } from "@playwright/test";
import * as cli from "@helpers/cli-helper";
import {getPmmAdminMinorVersion} from "@helpers/pmm-admin";

const containerName = 'valkey-primary-1';
let adminVersion: number;
const port = '6379'
const username = 'default';
const password = 'VKvl41568AsE';
const connectionTimeoutServiceName = 'valkey_connection_timeout_service';

test.describe('Valeky CLI tests', { tag: '@valkey' }, async () => {
  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'PSMDB valkey-primary-1 docker container should exist. please run pmm-framework with --database valkey');
    adminVersion = await getPmmAdminMinorVersion(containerName);
  });


  test("PMM-T2221 - User can use connection timeout while using pmm-admin add", async ({ }) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add valkey --connection-timeout=5s --username=${username} --password="${password}" --service-name=${connectionTimeoutServiceName} --host=${containerName} --port=${port}`);
    await output.exitCodeEquals(0);


    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout.trim()} | grep valkey_exporter | awk -F' ' '{print $4}'`)
    await cli.exec('sleep 2');
    const dataSourceName = await cli.exec(`docker exec ${containerName} cat /var/log/pmm-agent.log | grep ${agentId.stdout.trim()}`);

    console.log(dataSourceName);
    await dataSourceName.assertSuccess();
  });

  test("PMM-T2222 - User can change connection timeout using pmm-admin inventory change agent", async ({ }) => {
    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout} | grep valkey_exporter | awk -F' ' '{print $4}'`)
    await serviceId.exitCodeEquals(0);
    await agentId.exitCodeEquals(0);
    const chaneAgent = await cli.exec(`docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${agentId.stdout} --connection-timeout=4s`);
    await chaneAgent.exitCodeEquals(0);
  });

  test("PMM-T2223 - User can clear connection timeout using pmm-admin inventory change agent @connectionTimeoutPGSQL", async ({ }) => {
    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout} | grep valkey_exporter | awk -F' ' '{print $4}'`)
    await serviceId.exitCodeEquals(0);
    await agentId.exitCodeEquals(0);
    const chaneAgent = await cli.exec(`docker exec ${containerName} pmm-admin inventory change agent valkey-exporter ${agentId.stdout} --connection-timeout=0s`);
    await chaneAgent.exitCodeEquals(0);
  });

  test("PMM-T2224 - Connection timeout is used when adding service with command: pmm-admin add", async ({ }) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add valkey --connection-timeout=5s --username=${username} --password="${password}" --service-name=${connectionTimeoutServiceName}_timeout --host=195.15.25.15 --port=${port}`);
    await output.exitCodeEquals(1)

    expect(
      output.durationMs,
      `Expected pmm-admin to honor --connection-timeout=5s, got ${output.durationMs.toFixed(0)} ms`,
    ).toBeGreaterThan(5_000);
  });
});
