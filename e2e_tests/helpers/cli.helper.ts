import shell from 'shelljs';
import ExecReturn from '@interfaces/exec-return';

interface getMetrics {
  serviceName: string;
  agentUser?: string;
  dockerContainer?: string;
  agentPassword?: string;
}

export default class CliHelper {
  /**
   * Shell(sh) echo().to() wrapper to use in tests with handy logs creation
   *
   * @param   pathToFile  path to the file including file name
   * @param   content     content {@code string} to insert as file content
   */
  async createFile(pathToFile: string, content: string) {
    console.log(`echo: "${content}" >> ${pathToFile}`);
    shell.echo(content).to(pathToFile);
  }

  /**
   * Shell(sh) exec() wrapper to use outside of {@link test}
   * returns handy {@link ExecReturn} object.
   *
   * @param       command   sh command to execute
   * @return      {@link ExecReturnClass} instance
   */
  execute(command: string): ExecReturn {
    console.log(`exec: "${command}"`);

    const { stdout, stderr, code } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), { silent: false });

    if (stdout.length > 0) console.log(`Out: "${stdout}"`);
    if (stderr.length > 0) console.log(`Error: "${stderr}"`);

    return new ExecReturn(command, code, stdout, stderr);
  }

  /**
   * Silent Shell(sh) exec() wrapper to return handy {@link ExecReturn} object.
   * Provides no logs to skip huge outputs.
   *
   * @param       command   sh command to execute
   * @return      {@link ExecReturnClass} instance
   */
  execSilent(command: string): ExecReturn {
    const { stdout, stderr, code } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), { silent: true });

    return new ExecReturn(command, code, stdout, stderr);
  }

  /**
   * Scrape all metrics from exporter found by Service Name
   *
   * @param   options             Options to filter metrics by.
   *            serviceName - name of the service to search for the exporter
   *            agentUser - username to authenticate to exporter (optional)
   *            agentPassword - password for specified username to authenticate to exporter (optional)
   *            dockerContainer - docker container name to scrape metrics from (optional)
   */
  getMetrics(options: getMetrics): string {
    let { agentUser, agentPassword } = options;
    const prefix = options.dockerContainer ? `docker exec ${options.dockerContainer} ` : '';
    const adminList = this.execute(`${prefix || 'sudo '}pmm-admin list`)
      .assertSuccess()
      .getStdOutLines();
    // Get the last item in the split result
    const serviceId: string =
      adminList
        .find((item: string | string[]) => item.includes(options.serviceName))
        ?.trim()
        .split(' ')
        .pop() ?? '';

    if (!serviceId) {
      throw new Error(
        `Failed to find '${options.serviceName}' service is in pmm-admin list output:\n${adminList}`,
      );
    }

    const exporterLine = adminList
      .filter((item: string | string[]) => item.includes(serviceId))
      .find((item: string) => item.includes('_exporter'));

    if (!exporterLine) {
      throw new Error(
        `Failed to find exporter for service ID '${serviceId}' in pmm-admin list output:\n${adminList}`,
      );
    }

    const exporterDetails = exporterLine.split(' ').filter((item) => item.trim().length > 0);
    const listenPort = exporterDetails.at(5);

    agentPassword = agentPassword ? agentPassword : exporterDetails.at(3);
    agentUser = agentUser ? agentUser : 'pmm';

    if (!listenPort) {
      throw new Error(
        `Failed to find port of '${serviceId}' exporter is in pmm-admin list output:\n${adminList}`,
      );
    }

    return this.execute(
      `${prefix}curl -s "http://${agentUser}:${agentPassword}@127.0.0.1:${listenPort}/metrics"`,
    ).stdout;
  }
}
