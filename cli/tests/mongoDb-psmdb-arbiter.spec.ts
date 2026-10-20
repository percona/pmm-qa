import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import { removeMongoService } from '@root/helpers/pmm-admin';

const containerName = 'rs103';
const serviceName = 'arbiter_by_hostname';

test.describe('Percona Server MongoDB (PSMDB) arbiter CLI tests', { tag: '@arbiter-psmdb' }, () => {
  test.use({ pmmClientContainer: containerName });

  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker exec ${containerName} mongo --quiet --eval 'db.hello().arbiterOnly === true'`);
    await result.outContains('true', 'PSMDB arbiter rs103 should exist. please run pmm-framework with --database psmdb,SETUP_TYPE=psa');
  });

  test('PMM-T2399 - Verify that a PSMDB arbiter added by hostname without credentials is monitored', async ({}) => {
    await cli.exec(`docker exec ${containerName} pmm-admin remove mongodb ${serviceName} || true`);

    // An arbiter holds no users, and from 8.1 the connection check's buildInfo needs auth.
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add mongodb --host=${containerName} --port=27017 --agent-password=mypass --cluster=replicaset --replication-set=rs ${serviceName}`);
    await output.assertSuccess();
    await output.outContains('MongoDB Service added');

    await expect(async () => {
      const metrics = await cli.getMetrics(serviceName, 'pmm', 'mypass', containerName);
      expect(metrics, 'Arbiter exporter must report mongodb_up 1!').toMatch(/^mongodb_up(\{[^}]*\})? 1$/m);
      expect(metrics, 'Arbiter exporter must report the ARBITER (7) replica set state!').toMatch(/^mongodb_mongod_replset_my_state(\{[^}]*\})? 7$/m);
    }).toPass({ intervals: [2_000], timeout: 60_000 });

    await removeMongoService(containerName, serviceName);
  });
});
