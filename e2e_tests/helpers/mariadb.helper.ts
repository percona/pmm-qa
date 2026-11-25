import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const cliHelper = new CliHelper();

/**
 * Runs SETUP in the pmm-framework MariaDB CONTAINER, then restarts MariaDB under systemd and waits until it answers.
 * Performance Schema is read only at startup, so changing it needs the restart.
 */
export const restartMariaDb = async (container: string, setup: string) => {
  cliHelper.execute(`docker exec ${container} sh -c "${setup} && systemctl restart mariadb"`).assertSuccess();

  await expect(() => {
    cliHelper.execSilent(`docker exec ${container} mariadb-admin ping`).assertSuccess();
  }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.ONE_MINUTE });
};
