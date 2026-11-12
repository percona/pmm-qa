import CliHelper from '@helpers/cli.helper';

export default class DockerHelper {
  constructor(private readonly cliHelper: CliHelper) {}

  startContainer = (name: string, dockerArgs: string, network = 'pmm-qa') =>
    this.cliHelper
      .execute(`docker run --detach --quiet --name ${name} --network ${network} ${dockerArgs}`)
      .assertSuccess();

  supervisorctl = (action: 'restart' | 'start' | 'stop', program = 'pmm-managed', container = 'pmm-server') =>
    this.cliHelper.execute(`docker exec ${container} supervisorctl ${action} ${program}`).assertSuccess();
}
