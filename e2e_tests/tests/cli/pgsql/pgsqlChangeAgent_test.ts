import pmmTest from '@fixtures/pmmTest';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest('PMM-T9991 @pgsm-pmm-integration', async ({ cliHelper }) => {
    const containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep pdpgsql`);

    console.log(`Container name is: ${containerName.stdout}`);
  });
});