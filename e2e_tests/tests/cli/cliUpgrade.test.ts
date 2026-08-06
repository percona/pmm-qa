import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('PMM cli tests for upgrade', () => {
  pmmTest('Verify PMM Agents statuses @pre-upgrade @post-upgrade', async ({ cliHelper }) => {
    const containers: string[] = cliHelper.execSilent(`docker ps --format "{{.Names }}"`).stdout.split('\n');

    console.log(containers);

    for (const container of containers) {
      const statuses: string = cliHelper.execSilent(`docker exec ${container} pmm-admin`).stdout;

      console.log(statuses);
      // expect(statuses).not.toContain('Waiting' | 'Done')
    }
  });
});
