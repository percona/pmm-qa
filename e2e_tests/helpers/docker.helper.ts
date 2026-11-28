import Api from '@api/api';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';
import Credentials from '@helpers/credentials.helper';
import { GetService, ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

// Containers keep their name and address for the whole run.
const containersByAddress = new Map<string, string>();
const { perconaServer } = new Credentials();
// 'qa_slow' gives the PostgreSQL query its own query ID: pmm-framework's load runs pg_sleep() in another
// database, pg_stat_statements gives both the same ID, and Query Analytics keeps one row per ID.
const slowQueries: Partial<Record<string, string>> = {
  [ServiceType.mysql]: `mysql -u${perconaServer.username} -p${perconaServer.password} -e "SELECT SLEEP(12)"`,
  [ServiceType.postgresql]: `psql -U postgres -c "SELECT 'qa_slow', pg_sleep(12)"`,
};

export default class DockerHelper {
  constructor(private readonly cliHelper: CliHelper) {}

  getContainerAddress = (container: string) => {
    const address = this.cliHelper
      .execSilent(`docker inspect -f '{{(index .NetworkSettings.Networks "pmm-qa").IPAddress}}' ${container}`)
      .assertSuccess()
      .stdout.trim();

    if (!address) throw new Error(`Container ${container} has no address on network pmm-qa`);

    return address;
  };

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

  getContainerName = (namePattern: string) => {
    const [container] = this.cliHelper
      .execSilent(`docker ps --filter 'name=${namePattern}' --format '{{.Names}}'`)
      .assertSuccess()
      .getStdOutLines();

    if (!container) throw new Error(`No running container matches ${namePattern}`);

    return container;
  };

  getContainerVolume = (container: string, destination: string) => {
    const volume = this.cliHelper
      .execSilent(
        `docker inspect -f '{{range .Mounts}}{{if eq .Destination "${destination}"}}{{.Name}}{{end}}{{end}}' ${container}`,
      )
      .assertSuccess()
      .stdout.trim();

    if (!volume) throw new Error(`Container ${container} has no volume on ${destination}`);

    return volume;
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

  // The first line of `docker port` is the IPv4 binding, as 127.0.0.1:<port> or 0.0.0.0:<port>.
  getPublishedPort = (container: string, port: number) =>
    Number(
      this.cliHelper
        .execSilent(`docker port ${container} ${port}/tcp`)
        .assertSuccess()
        .getStdOutLines()[0]
        .split(':')
        .at(-1),
    );

  getServiceContainer = async (api: Api, { node_id }: GetService) =>
    this.getContainerByAddress(await api.inventoryApi.getNodeAddress(node_id));

  // pmm-framework names each client node after its database container.
  runSlowQueries = (services: GetService[]) => {
    for (const { node_name, service_type } of services) {
      const query = slowQueries[service_type];

      if (!query) throw new Error(`No slow query for service type ${service_type}`);

      this.cliHelper.execute(`docker exec --detach ${node_name} ${query}`).assertSuccess();
    }
  };

  startContainer = (name: string, dockerArgs: string, network = 'pmm-qa') =>
    this.cliHelper
      .execute(`docker run --detach --quiet --name ${name} --network ${network} ${dockerArgs}`)
      .assertSuccess();

  supervisorctl = (action: 'restart' | 'start' | 'stop', program = 'pmm-managed', container = 'pmm-server') =>
    this.cliHelper.execute(`docker exec ${container} supervisorctl ${action} ${program}`).assertSuccess();

  // A restarting exporter has no process for a moment, which counts as not yet rather than as a flag gone.
  verifyExporterCommandLine = async (
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
