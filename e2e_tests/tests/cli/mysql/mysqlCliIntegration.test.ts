import pmmTest from '@fixtures/pmmTest';

let testContainerName: string;

pmmTest.beforeAll(async ({ cliHelper }) => {
  const out = cliHelper.execSilent('docker ps --filter \'name=(ps|mysql)\' --format "{{.Names }}"');
  testContainerName = out.stdout;
});

pmmTest(
  'PMM-Tx - Verify pmm-agent is not crashed for specific queries',
  { tag: ['@pmm-ps-integration'] },
  async ({ cliHelper, credentials }) => {
    const containerPort = testContainerName.includes('8.4') ? 3306 : 3307;
    const user = credentials.perconaServer.ps_84;

    let out = await cliHelper.execSilent(`docker exec ${testContainerName} pmm-admin status`);
    out.assertSuccess();

    out = await cliHelper.execSilent(
      `docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "set long_query_time = 0; SELECT @@GLOBAL.read_only AS Value;"`,
    );
    out.assertSuccess();

    out = await cliHelper.execSilent(`docker exec ${testContainerName} pmm-admin status`);
    out.assertSuccess();
  },
);
