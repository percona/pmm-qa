import pmmTest from '@fixtures/pmmTest';

let testContainerName: string;

pmmTest.beforeAll(async ({ cliHelper }) => {
  const out = cliHelper.execSilent('docker ps --filter \'name=(ps|mysql)\' --format "{{.Names }}"');

  testContainerName = out.stdout.split('\n')[0];
});

pmmTest(
  'PMM-T2113 - Verify pmm-agent is not not crashing while parsing the slow query log file',
  { tag: ['@pmm-ps-integration'] },
  async ({ cliHelper, credentials }) => {
    const user = credentials.perconaServer.ps_84;
    let out = await cliHelper.execSilent(`docker exec ${testContainerName} pmm-admin status`);

    out.assertSuccess();
    out = await cliHelper.execSilent(
      `docker exec ${testContainerName} mysql -h 127.0.0.1 --port 3306 -u ${user.username} -p${user.password} -e "set long_query_time = 0; SELECT @@GLOBAL.read_only AS Value;"`,
    );
    out.assertSuccess();
    out = await cliHelper.execSilent(`docker exec ${testContainerName} pmm-admin status`);
    out.assertSuccess();
  },
);
