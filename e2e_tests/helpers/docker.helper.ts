import { expect } from '@playwright/test';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';

export default class DockerHelper {
  constructor(private readonly cliHelper: CliHelper) {}

  startContainer = (name: string, dockerArgs: string, network = 'pmm-qa') =>
    this.cliHelper
      .execute(`docker run --detach --quiet --name ${name} --network ${network} ${dockerArgs}`)
      .assertSuccess();

  supervisorctl = (action: 'restart' | 'start' | 'stop', program = 'pmm-managed', container = 'pmm-server') =>
    this.cliHelper.execute(`docker exec ${container} supervisorctl ${action} ${program}`).assertSuccess();

  waitForHealthy = async (container: string, timeout = Timeouts.FIVE_MINUTES) => {
    await expect
      .poll(
        () =>
          this.cliHelper
            .execSilent(`docker inspect -f '{{.State.Health.Status}}' ${container}`)
            .stdout.trim(),
        { intervals: [Timeouts.FIVE_SECONDS], message: `${container} should become healthy`, timeout },
      )
      .toBe('healthy');
  };
}
