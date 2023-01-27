import { executeCommand } from "../helpers/commandLine";
import SetupParameters from "../helpers/setupParameters.interface";
import { dockerNetworkName, pmmIntegrationClientName } from "../integration-setup";

const addClientPdPgsql = async (parameters: SetupParameters, numberOfClients: number) => {
  console.log(`Installing ${numberOfClients} Percona Distribution for PostgreSQL with version ${parameters.pgsqlVersion}`);
  const timeStamp = Date.now();
  let pdpgsql_port: number = 6432;
  const pdpgsql_password = 'oFukiBRg7GujAJXq3tmd';
  for (let index = 0; index < numberOfClients; index++) {
    const containerName = `pdpgsql_integration_${timeStamp}_${index}`;
    await executeCommand(`docker run --name ${containerName} -p ${pdpgsql_port + index}:5432 -d -e POSTGRES_PASSWORD=${pdpgsql_password} perconalab/percona-distribution-postgresql:${parameters.pgsqlVersion} -c shared_preload_libraries=pg_stat_statements,pg_stat_monitor -c pg_stat_monitor.pgsm_bucket_time=60 -c pg_stat_monitor.pgsm_max_buckets=10 -c pg_stat_monitor.pgsm_query_shared_buffer=20 -c pg_stat_monitor.pgsm_max=100 -c track_activity_query_size=2048 -c pg_stat_statements.max=10000 -c pg_stat_monitor.pgsm_normalized_query=0 -c pg_stat_monitor.pgsm_query_max_len=10000 -c pg_stat_monitor.pgsm_enable_query_plan=1 -c pg_stat_statements.track=all -c pg_stat_statements.save=off -c track_io_timing=on`);
    await executeCommand('sleep 20');
    await executeCommand(`sudo docker network connect ${dockerNetworkName} ${containerName}`);
    await executeCommand(`docker exec ${containerName} psql -h localhost -U postgres -c 'create extension pg_stat_monitor'`);
    await executeCommand(`docker exec ${containerName} psql -h localhost -U postgres -c 'SELECT pg_reload_conf();'`);
    const prefix = parameters.ci? 'sudo ' : `sudo docker exec ${pmmIntegrationClientName} `
    const serviceAddress = parameters.ci? `127.0.0.1:${pdpgsql_port + index}` : `${containerName}:5432`
    if ((index & 2) === 0) {
      if (parameters.metricsMode) {
        await executeCommand(`${prefix}pmm-admin add postgresql --username=postgres --password=${pdpgsql_password} --environment=pdpgsql-prod --cluster=pdpgsql-prod-cluster --metrics-mode=${parameters.metricsMode} --query-source=pgstatmonitor --replication-set=pdpgsql-repl2 ${containerName} ${serviceAddress}`);
      } else {
        await executeCommand(`${prefix}pmm-admin add postgresql --username=postgres --password=${pdpgsql_password} --environment=pdpgsql-prod --cluster=pdpgsql-prod-cluster --query-source=pgstatmonitor --replication-set=pdpgsql-repl2 ${containerName} ${serviceAddress}`);
      }
    } else {
      if (parameters.metricsMode) {
        await executeCommand(`${prefix}pmm-admin add postgresql --username=postgres --password=${pdpgsql_password} --environment=pdpgsql-dev --cluster=pdpgsql-dev-cluster --metrics-mode=${parameters.metricsMode} --query-source=pgstatmonitor --replication-set=pdpgsql-repl1 ${containerName} ${serviceAddress}`);
      } else {
        await executeCommand(`${prefix}pmm-admin add postgresql --username=postgres --password=${pdpgsql_password} --environment=pdpgsql-dev --cluster=pdpgsql-dev-cluster --query-source=pgstatmonitor --replication-set=pdpgsql-repl1 ${containerName} ${serviceAddress}`);
      }
    }
    await executeCommand(`sudo docker exec ${containerName} mkdir /tmp/sql`)
    await executeCommand('wget https://raw.githubusercontent.com/percona/pmm-agent/main/testqueries/postgres/pg_stat_monitor_load.sql');
    await executeCommand(`sudo docker cp pg_stat_monitor_load.sql ${containerName}:/tmp/sql/pg_stat_monitor_load.sql`)
    await executeCommand('rm pg_stat_monitor_load.sql');
    await executeCommand(`sudo docker exec ${containerName} bash -c "psql -h localhost -U postgres -c 'create database test1'"`)
    await executeCommand(`sudo docker exec -u postgres ${containerName} psql test1 postgres -f /tmp/sql/pg_stat_monitor_load.sql`)
  }
}

export default addClientPdPgsql;