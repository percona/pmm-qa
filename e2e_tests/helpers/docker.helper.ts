import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import { GetService, ServiceType } from '@interfaces/inventory';

const { perconaServer } = new Credentials();
// 'qa_slow' gives the PostgreSQL query its own query ID: pmm-framework's load runs pg_sleep() in another
// database, pg_stat_statements gives both the same ID, and Query Analytics keeps one row per ID.
const slowQueries: Partial<Record<string, string>> = {
  [ServiceType.mysql]: `mysql -u${perconaServer.username} -p${perconaServer.password} -e "SELECT SLEEP(12)"`,
  [ServiceType.postgresql]: `psql -U postgres -c "SELECT 'qa_slow', pg_sleep(12)"`,
};

export default class DockerHelper {
  constructor(private readonly cliHelper: CliHelper) {}

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
}
