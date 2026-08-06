import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('PMM cli tests for upgrade', () => {
  const nonClientContainers = ['ldap-server', 'minio'];

  pmmTest('Verify PMM Agents statuses @pre-upgrade @post-upgrade', async ({ cliHelper }) => {
    const containers: string[] = cliHelper
      .execSilent(`docker ps --format "{{.Names }}"`)
      .stdout.split('\n')
      .filter((item) => item && !nonClientContainers.includes(item));

    for (const container of containers) {
      const pmmAdminStatus: string = cliHelper.execSilent(`docker exec ${container} pmm-admin status`).stdout;
      const pmmAdminList: string = cliHelper.execSilent(`docker exec ${container} pmm-admin list`).stdout;

      expect(
        pmmAdminStatus,
        `Agent status contains wrong status in ${container} container. Error in: ${pmmAdminStatus}`,
      ).not.toMatch(/Waiting|Done|Unknown|Initialization Error|Stopping/);
      expect(
        pmmAdminList,
        `Agent list contains wrong status in ${container} container. Error in: ${pmmAdminList}`,
      ).not.toMatch(/Waiting|Done|Unknown|Initialization Error|Stopping/);
    }
  });

  pmmTest('Verify PMM client versions before upgrade @pre-upgrade', async ({ cliHelper }) => {
    const containers: string[] = cliHelper
      .execSilent(`docker ps --format "{{.Names }}"`)
      .stdout.split('\n')
      .filter((item) => item && !nonClientContainers.includes(item));

    console.log(containers);

    for (const container of containers) {
      const pmmAdminVersion: string = cliHelper.execSilent(
        `docker exec ${container} sh -lc "pmm-admin status | grep pmm-admin | awk '{print $3}'"`,
      ).stdout;
      const pmmAgentVersion: string = cliHelper.execSilent(
        `docker exec ${container} sh -lc "pmm-admin status | grep pmm-admin | awk '{print $3}'"`,
      ).stdout;

      console.log(
        `PMM Admin version is: ${pmmAdminVersion} for command: docker exec ${container} sh -lc "pmm-admin status | grep pmm-admin | awk '{print $3}'"`,
      );
      console.log(
        `PMM Agent version is: ${pmmAgentVersion} for command: docker exec ${container} sh -lc "pmm-admin status | grep pmm-admin | awk '{print $3}'"`,
      );
      console.log(`Expected version is: ${process.env.CLIENT_VERSION}`);

      expect(
        pmmAdminVersion,
        `PMM admin version: ${pmmAdminVersion} does not equal expected PMM client version ${process.env.CLIENT_VERSION} for service ${container},`
      ).toContain(process.env.CLIENT_VERSION);
      expect(
        pmmAgentVersion,
        `PMM agent version: ${pmmAdminVersion} does not equal expected PMM client version ${process.env.CLIENT_VERSION} for service ${container},`
      ).toContain(process.env.CLIENT_VERSION);
    }
  });
});
