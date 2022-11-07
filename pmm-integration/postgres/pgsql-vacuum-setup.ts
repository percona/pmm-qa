import { executeCommand } from "../helpers/commandLine";
import { stopAndRemoveContainer } from "../helpers/docker";

const pgsqlVacuumSetup = async ({pgsqlVersion = 'latest'}) => {
  const dockerContainerName = 'pgsql_vacuum_db';
  console.log('Setting up Postgres for vacuum monitoring');
  console.log(pgsqlVersion)
  await stopAndRemoveContainer(dockerContainerName);
  await executeCommand(`docker run --name ${dockerContainerName} -p 7432:5432 -e POSTGRES_PASSWORD=YIn7620U1SUc -d postgres:${pgsqlVersion} -c shared_preload_libraries="pg_stat_statements" -c pg_stat_statements.max=10000 -c pg_stat_statements.track=all`);
  await executeCommand('sleep 20')
  await executeCommand(`docker exec ${dockerContainerName} apt-get update`);
  await executeCommand(`docker exec ${dockerContainerName} apt-get install -y wget unzip`);
  await executeCommand(`docker exec ${dockerContainerName} wget https://www.postgresqltutorial.com/wp-content/uploads/2019/05/dvdrental.zip`);
  await executeCommand(`docker exec ${dockerContainerName} unzip dvdrental.zip`);
  await executeCommand(`docker exec ${dockerContainerName} psql -U postgres -c "CREATE EXTENSION pg_stat_statements;"`);
  await executeCommand(`docker exec ${dockerContainerName} psql -U postgres -c 'create database dvdrental;"`);
  await executeCommand(`docker exec ${dockerContainerName} pg_restore -U postgres -d dvdrental dvdrental.tar"`);
}

export default pgsqlVacuumSetup;