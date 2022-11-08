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
  await executeCommand(`docker exec ${dockerContainerName} psql -U postgres -c 'create database dvdrental;'`);
  await executeCommand(`docker exec ${dockerContainerName} pg_restore -U postgres -d dvdrental dvdrental.tar`);

  await executeCommand(`rm dvdrental.tar.xz || true`);
  await executeCommand(`rm dvdrental.sql || true`);
  await executeCommand(`wget https://github.com/percona/pmm-qa/raw/PMM-10244-2/pmm-tests/postgres/SampleDB/dvdrental.tar.xz`);
  await executeCommand(`tar -xvf dvdrental.tar.xz`);
  await executeCommand(`docker cp dvdrental.sql ${dockerContainerName}:/`);
  await executeCommand(`docker exec ${dockerContainerName} psql -d dvdrental -f dvdrental.sql -U postgres`);

  await executeCommand(`pmm-admin add postgresql --username=postgres --password=YIn7620U1SUc pgsql_vacuum_db localhost:7432`);
 
  let j: number = 0;
  while(j < 3) {
    const oldLength = Math.floor(Math.random() * 120) + 100;
    const newLength = Math.floor(Math.random() * 120) + 100;
    const table = Math.floor(Math.random() * 100) + 1;
    console.log('Random Variables: ');
    console.log(`old Length: ${oldLength}`)
    console.log(`new Length: ${newLength}`)
    console.log(`table: ${table}`)
    const count: string = (await executeCommand(`docker exec ${dockerContainerName} psql -U postgres -d dvdrental -c "select count(*) from film_testing_${table} where length=${oldLength};" | tail -3 | head -1 | xargs`)).stdout.trim();
    const countInt: number = parseInt(count);
    console.log(`Command: ${countInt}`)
    await executeCommand(`docker exec ${dockerContainerName} psql -U postgres -d dvdrental -c "delete from film_testing_${table} where length=${oldLength};"`);
    let i = 0;
    while(i < countInt) {
      await executeCommand(`docker exec ${dockerContainerName} psql -U postgres -d dvdrental -c "insert into film_testing_${table} values (${i}, 'title for ${i}', 'Description for ${i}', ${oldLength});" `)
      i++;
    }
    await executeCommand(`docker exec  ${dockerContainerName} psql -U postgres -d dvdrental -c "update film_testing_${table} set length=${newLength} where length=${length};"`)
    j++;
  }
}

export default pgsqlVacuumSetup;