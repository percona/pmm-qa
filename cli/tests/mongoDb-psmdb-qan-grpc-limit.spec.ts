import { test, expect } from '@helpers/test';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as mongo from '@helpers/mongo';
import * as pmmApi from '@helpers/pmm-api-helper';
import * as pmmCli from '@helpers/pmm-cli-helper';
import { clientCredentialsFlags, gssapi } from '@helpers/constants';

const containerName = 'rs101';
const replIpPort = 'rs101:27017';
const mongoUri = 'mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true';
const database = 'pmm_qa_grpc_limit';
const serverErrors = 'failed to send CollectRequest to QAN|received message larger than max|ResourceExhausted';
const agentReconnects = 'Failed to send QanCollect request|Connection closed|Establishing two-way communication channel';

test.describe('PSMDB QAN keeps every query of a minute larger than the gRPC message limits', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ pmmClientContainer: containerName });
  test.skip(gssapi.enabled === 'true', 'The QAN message size does not depend on the authentication mechanism');

  let serviceName = '';

  test.beforeEach(async ({}) => {
    await mongo.runOnPrimary(containerName, mongoUri, `const d = db.getSiblingDB("${database}"); d.seed.insertOne({ x: 1 }); d.setProfilingLevel(0); d.system.profile.drop();`
      + ' d.createCollection("system.profile", { capped: true, size: 256 * 1024 * 1024 }); d.setProfilingLevel(2, { slowms: 0 });');
  });

  test.afterEach(async ({}) => {
    await pmmCli.runEach([
      async () => {
        if (serviceName) await pmmAdmin.removeMongoService(containerName, serviceName);
      },
      async () => mongo.runOnPrimary(containerName, mongoUri, `const d = db.getSiblingDB("${database}"); d.setProfilingLevel(0); d.dropDatabase();`),
    ]);
    serviceName = '';
  });

  const runBurstAndExpectEveryQueryInQan = async (service: string, queries: number) => {
    // Added after the profile collection is recreated: dropping it ends the cursors of profiler agents already reading it.
    const { profilerId } = await pmmAdmin.addMongoServiceAgents(containerName, `${clientCredentialsFlags} --query-source=profiler --max-query-length=20480`, service, replIpPort);
    serviceName = service;
    expect(profilerId, `mongodb_profiler_agent for service ${service} not found`).toBeTruthy();
    await pmmAdmin.expectAgentsRunning(containerName, [profilerId], true);

    const since = new Date();
    const { start, end } = await mongo.runQueryBurstInOneMinute(containerName, mongoUri, database, queries);
    expect(Math.floor(end.getTime() / 60_000), `The queries ran from ${start.toISOString()} to ${end.toISOString()}, not inside one minute`)
      .toEqual(Math.floor(start.getTime() / 60_000));

    await expect(async () => {
      expect(await pmmApi.getQanTotalQueries(service, new Date(Date.now() - 15 * 60_000)), `QAN query classes of ${service}`).toBeGreaterThanOrEqual(queries);
    }).toPass({ intervals: [10_000], timeout: 4 * 60_000 });

    expect(await pmmCli.logLinesSince('pmm-server', '/srv/logs/pmm-managed.log* /srv/logs/qan-api2.log*', serverErrors, since), 'PMM Server rejected a QAN message').toEqual([]);

    return since;
  };

  test('PMM-T2860 - Verify QAN keeps every query when one minute of collected queries exceeds 20 MB @psmdb', async ({}) => {
    test.setTimeout(8 * 60_000);

    await runBurstAndExpectEveryQueryInQan('mongo_grpc_limit_20mb', 1500);
  });

  test('PMM-T2861 - Verify QAN keeps every query and PMM Client stays connected when one minute of collected queries exceeds 100 MB @psmdb', async ({}) => {
    test.setTimeout(8 * 60_000);

    const since = await runBurstAndExpectEveryQueryInQan('mongo_grpc_limit_100mb', 3000);

    expect(await pmmCli.logLinesSince(containerName, '/var/log/pmm-agent.log', agentReconnects, since), 'pmm-agent lost its connection to PMM Server').toEqual([]);
  });
});
