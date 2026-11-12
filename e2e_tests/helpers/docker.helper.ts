import Api from '@api/api';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';
import { GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

// Containers keep their name and address for the whole run.
const containersByAddress = new Map<string, string>();

export default class DockerHelper {
  constructor(private readonly cliHelper: CliHelper) {}

  startContainer = (name: string, dockerArgs: string, network = 'pmm-qa') =>
      this.cliHelper
          .execute(`docker run --detach --quiet --name ${name} --network ${network} ${dockerArgs}`)
          .assertSuccess();

  supervisorctl = (action: 'restart' | 'start' | 'stop', program = 'pmm-managed', container = 'pmm-server') =>
      this.cliHelper.execute(`docker exec ${container} supervisorctl ${action} ${program}`).assertSuccess();

  // pmm-agent registers a node under its container name, or under its IP when set up with one.
  getContainerByAddress = (address: string): string => {
    const cached = containersByAddress.get(address);

    if (cached) return cached;

    const containers = this.cliHelper
        .execSilent(
            "docker ps -q | xargs docker inspect -f '{{.Name}} {{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'",
        )
        .assertSuccess()
        .getStdOutLines()
        .map((line) => line.trim().replace(/^\//, '').split(/\s+/));
    const container = containers.find(([name, ...ips]) => name === address || ips.includes(address));

    if (!container) throw new Error(`No running container has name or IP ${address}`);

    containersByAddress.set(address, container[0]);

    return container[0];
  };

  // 000 when nothing answers on the address, as for an exporter listening only on its own host's 127.0.0.1.
  getHttpStatus = (container: string, url: string) =>
      this.cliHelper
          .execSilent(`docker exec ${container} curl -s -o /dev/null --max-time 5 -w '%{http_code}' ${url}`)
          .stdout.trim();

  // Read from /proc, as not every database image has ps; processes that exit meanwhile are skipped.
  getProcessCommandLine = (container: string, ...matches: string[]) =>
      this.cliHelper
          .execSilent(
              `docker exec ${container} sh -c 'for f in /proc/[0-9]*/cmdline; do tr "\\000" " " < "$f" 2>/dev/null; echo; done'`,
          )
          .getStdOutLines()
          .find((line) => matches.every((match) => line.includes(match)));

  getServiceContainer = async (api: Api, { node_id }: GetService) =>
      this.getContainerByAddress(await api.inventoryApi.getNodeAddress(node_id));

  // A restarting exporter has no process for a moment, which counts as not yet rather than as a flag gone.
  waitForExporterCommandLine = async (
      container: string,
      listenPort: number,
      { matches, pattern }: { matches: boolean; pattern: RegExp },
  ) => {
    await expect
        .poll(
            () => {
              const commandLine = this.getProcessCommandLine(container, 'listen-address=', `:${listenPort}`);

              return commandLine !== undefined && pattern.test(commandLine) === matches;
            },
            {
              message: `exporter on port ${listenPort} ${matches ? 'runs with' : 'runs without'} ${pattern}`,
              timeout: Timeouts.ONE_MINUTE,
            },
        )
        .toBe(true);
  };
}