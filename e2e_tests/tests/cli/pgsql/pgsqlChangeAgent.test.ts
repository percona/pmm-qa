import pmmTest from '@fixtures/pmmTest';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest('PMM-T9991 @pgsm-pmm-integration', async ({ cliHelper }) => {
    const newPassword = 'new_password_change_agent';
    const containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep pdpgsql`).stdout;
    const pgVersion: string = containerName.match(/\d+/)[0]?;
    const serviceName = cliHelper.execSilent(
      `docker exec ${containerName} pmm-admin list | grep pdpgsql_pmm | head -1 | awk -F' ' '{print $2}'`,
    ).stdout;
    const serviceId = cliHelper.execSilent(
      `docker exec ${containerName} pmm-admin list | grep pdpgsql_pmm | head -1 | awk -F' ' '{print $4}'`,
    ).stdout;

    console.log(cliHelper.execSilent(
      `docker exec ${containerName} pmm-admin list'`,
    ).stdout);
    console.log(`Container name is: ${containerName}`);
    console.log(`Service name is: ${serviceName}`);
    console.log(`Service ID is: ${serviceId}`);
    cliHelper.execSilent(
      `docker exec ${containerName} psql -U postgres -c "ALTER USER pmm WITH PASSWORD '${newPassword}';"`,
    );

    const restart = cliHelper.execSilent(
      `docker exec ${containerName} pg_ctlcluster ${pgVersion} main restart`,
    );

    console.log(restart.stdout)
  });
});
