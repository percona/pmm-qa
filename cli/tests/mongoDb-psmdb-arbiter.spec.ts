import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { removeMongoService } from '@root/helpers/pmm-admin';
import * as pbm from '@helpers/pbm';

const containerName = 'rs103';
const serviceName = 'arbiter_by_localhost';

test.describe('Percona Server MongoDB (PSMDB) arbiter CLI tests', { tag: '@arbiter-psmdb' }, () => {
  test.use({ pmmClientContainer: containerName });

  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker exec ${containerName} mongo --quiet --eval 'db.hello().arbiterOnly === true'`);
    await result.outContains('true', 'PSMDB arbiter rs103 should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=psa');
  });

  test('PMM-T2399 - Verify that a PSMDB arbiter added through 127.0.0.1 without credentials is monitored', async ({}) => {
    await cli.exec(`docker exec ${containerName} pmm-admin remove mongodb ${serviceName} || true`);

    // An arbiter holds no users; pmm-framework already adds this one by hostname.
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb --host=127.0.0.1 --port=27017 --agent-password=mypass --cluster=replicaset --replication-set=rs ${serviceName}`);
    await output.assertSuccess();
    await output.outContains('MongoDB Service added');

    await expect(async () => {
      const metrics = await cli.getMetrics(serviceName, 'pmm', 'mypass', containerName);
      expect(metrics, 'Arbiter exporter must report mongodb_up 1!').toMatch(/^mongodb_up(\{[^}]*\})? 1$/m);
      expect(metrics, 'Arbiter exporter must report the ARBITER (7) replica set state!').toMatch(/^mongodb_mongod_replset_my_state(\{[^}]*\})? 7$/m);
    }).toPass({ intervals: [2_000], timeout: 60_000 });

    await removeMongoService(containerName, serviceName);
  });

  test('PMM-15222 - Verify the arbiter has no pbm agent version series while each data-bearing member has one for its own agent', { tag: '@pbm-arbiter-external' }, async ({}) => {
    const nodes = (await pbm.pbmStatus('rs101')).cluster.flatMap((replset) => replset.nodes);

    for (const member of ['rs101', 'rs102']) {
      const host = `${member}:27017`;
      const version = nodes.find((node) => node.host === host)?.agent.replace(/^v/, '');

      await expect(async () => {
        const versions = pbm.selectSeries(await pbm.scrapePbm(member), 'mongodb_pbm_agent_version_info');

        expect(versions.map((item) => item.labels), `${member}: agent version series`).toEqual([
          {
            host,
            replica_set: 'rs',
            self: '1',
            version,
          },
        ]);
      }).toPass({ intervals: [3_000], timeout: 120_000 });
    }

    await expect(async () => {
      const versions = pbm.selectSeries(await pbm.scrapePbm(containerName), 'mongodb_pbm_agent_version_info');

      expect(pbm.seriesTexts(versions), 'agent version series of the arbiter').toEqual([]);
    }).toPass({ intervals: [3_000], timeout: 60_000 });
  });
});
