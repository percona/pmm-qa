import AdmZip from 'adm-zip';
import shell from 'shelljs';
import ExecReturn from '@interfaces/execReturn';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

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
  createFile = async (pathToFile: string, content: string) => {
    console.log(`echo: "${content}" >> ${pathToFile}`);
    shell.echo(content).to(pathToFile);
  };

  /**
   * Silent Shell(sh) exec() wrapper to return handy {@link ExecReturn} object.
   * Provides no logs to skip huge outputs.
   *
   * @param       command   sh command to execute
   * @param       timeout   ms after which the command is killed and returns a non-zero code
   * @return      {@link ExecReturnClass} instance
   */
  execSilent = (command: string, timeout?: number): ExecReturn => {
    const { code, stderr, stdout } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), {
      silent: true,
      timeout,
    });

    return new ExecReturn(command, code, stdout, stderr);
  };

  /**
   * Shell(sh) exec() wrapper to use outside of {@link test}
   * returns handy {@link ExecReturn} object.
   *
   * @param       command   sh command to execute
   * @param       timeout   ms after which the command is killed and returns a non-zero code
   * @return      {@link ExecReturnClass} instance
   */
  execute = (command: string, timeout?: number): ExecReturn => {
    console.log(`exec: "${command}"`);

    const { code, stderr, stdout } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), {
      silent: false,
      timeout,
    });

    if (stdout.length > 0) console.log(`Out: "${stdout}"`);
    if (stderr.length > 0) console.log(`Error: "${stderr}"`);

    return new ExecReturn(command, code, stdout, stderr);
  };

  /**
   * Scrape all metrics from exporter found by Service Name
   *
   * @param   options             Options to filter metrics by.
   *            serviceName - name of the service to search for the exporter
   *            agentUser - username to authenticate to exporter (optional)
   *            agentPassword - password for specified username to authenticate to exporter (optional)
   *            dockerContainer - docker container name to scrape metrics from (optional)
   */
  getMetrics = (options: getMetrics): string => {
    let { agentPassword, agentUser } = options;
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
  };

  getPmmAdminField = (output: string, field: string): string => {
    const value = output
      .split('\n')
      .find((line) => line.startsWith(field))
      ?.split(':')[1]
      ?.trim();

    if (!value) throw new Error(`Failed to find '${field}' in pmm-admin output:\n${output}`);

    return value;
  };

  getSummaryAgentsInfo = (container: string, archivePath: string) => {
    const archive = this.execute(`docker exec ${container} pmm-admin summary`)
      .assertSuccess()
      .stdout.split(' ')[0];

    this.execute(`docker cp ${container}:/${archive} "${archivePath}"`).assertSuccess();

    return (
      JSON.parse(new AdmZip(archivePath).readAsText('client/status.json')) as {
        agents_info: { agent_type: string; process_exec_path?: string }[];
      }
    ).agents_info;
  };

  /**
   * Stops and removes a docker container, ignoring one that does not exist. Any other removal
   * failure is reported here, since the name would stay taken for the next `docker run`.
   * Stopping first lets PMM Server's PostgreSQL remove its postmaster.pid, which a container
   * recreated on the same volume would otherwise trip over.
   *
   * @param   containerName   name of the container to remove
   */
  removeContainer = (containerName: string) => {
    this.execSilent(`docker stop ${containerName} || true`);

    const removal = this.execSilent(`docker rm -f ${containerName}`);

    if (!removal.stderr.includes('No such container')) removal.assertSuccess();
  };

  verifyAgentsHealthy = async (containers: string[], timeout = Timeouts.ONE_MINUTE) => {
    const badStatus = /Waiting|Done|Unknown|Initialization Error|Stopping/;

    expect(containers, 'No pmm-client containers to check').not.toHaveLength(0);

    await expect(() => {
      for (const container of containers) {
        for (const command of ['status', 'list']) {
          const output = this.execSilent(`docker exec ${container} pmm-admin ${command}`).stdout;

          expect(output, `pmm-admin ${command} in ${container} has a bad agent status`).not.toMatch(
            badStatus,
          );
        }
      }
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout });
  };
}
