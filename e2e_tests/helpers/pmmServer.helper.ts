import CliHelper from '@helpers/cli.helper';

export default class PmmServerHelper {
  constructor(
    private readonly cliHelper: CliHelper,
    private readonly container = 'pmm-server',
  ) {}

  supervisorctl = (action: 'restart' | 'start' | 'stop', program = 'pmm-managed') =>
    this.cliHelper
      .execute(`docker exec ${this.container} supervisorctl ${action} ${program}`)
      .assertSuccess();
}
