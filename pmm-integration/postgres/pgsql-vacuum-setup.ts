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
  const oldLength = Math.floor(Math.random() * 120) + 100;
  const newLength = Math.floor(Math.random() * 120) + 100;
  const table = Math.floor(Math.random() * 100) + 1;
  await executeCommand(`pmm-admin add postgresql --username=postgres --password=YIn7620U1SUc pgsql_vacuum_db localhost:7432`);
  await executeCommand(`j=0 \ 
    while [ $j -lt 3 ]  \
    do \
      export LENGTH=$(shuf -i 100-120 -n 1) \
      export LENGTH_NEW=$(shuf -i 100-120 -n 1) \
      export TABLE=$(shuf -i 1-1000 -n 1) \
      export COUNT=$(docker exec pgsql_vacuum_db psql -U postgres -d dvdrental -c "select count(*) from film_testing_\${TABLE} where length=\${LENGTH};" | tail -3 | head -1 | xargs) \
      docker exec pgsql_vacuum_db psql -U postgres -d dvdrental -c "delete from film_testing_\${TABLE} where length=\${LENGTH};" \
      i=0 \
      while [ "$i" -le \${COUNT} ]; do \
          docker exec pgsql_vacuum_db psql -U postgres -d dvdrental -c "insert into film_testing_\${TABLE} values (\${i}, 'title for \${i}', 'Description for \${i}', \${LENGTH});" \
          i=$(( i + 1 )) \
      done  \
      docker exec pgsql_vacuum_db psql -U postgres -d dvdrental -c "update film_testing_\${TABLE} set length=\${LENGTH_NEW} where length=\${LENGTH};" \
      sleep 5 \ 
      j=$(( j + 1 )) \
  done \ 
  `)

}

export default pgsqlVacuumSetup;