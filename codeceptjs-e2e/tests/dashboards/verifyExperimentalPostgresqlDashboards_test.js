const assert = require('assert');

Feature('Test PostgreSQL Experimental Dashboards');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T1365 - Verify PostgreSQL Vacuum monitoring dashboard @dashboards @experimental',
  async ({
    I, experimentalPostgresqlDashboardsPage,
  }) => {
    const pgsqlContainerName = await I.verifyCommand('docker ps -f name=pgsql --format "{{ .Names }}"');

    await I.verifyCommand(`docker exec ${pgsqlContainerName} apt-get update`);
    await I.verifyCommand(`docker exec ${pgsqlContainerName} apt-get install -y wget unzip`);
    await I.verifyCommand(`docker exec ${pgsqlContainerName} wget https://github.com/percona/pmm-qa/raw/PMM-10244-2/pmm-tests/postgres/SampleDB/dvdrental.tar.xz`);
    await I.verifyCommand(`docker exec ${pgsqlContainerName} tar -xvf dvdrental.tar.xz`);
    await I.verifyCommand(`docker exec ${pgsqlContainerName} psql -U postgres -c 'create database dvdrental;'`);
    await I.verifyCommand(`docker exec ${pgsqlContainerName} psql -d dvdrental -f dvdrental.sql -U postgres`);

    for (let i = 0; i < 3; i++) {
      const oldLength = Math.floor(Math.random() * 120) + 100;
      const newLength = Math.floor(Math.random() * 120) + 100;
      const table = Math.floor(Math.random() * 1000) + 1;
      const count = parseInt(await I.verifyCommand(`docker exec ${pgsqlContainerName} psql -U postgres -d dvdrental -c "select count(*) from film_testing_${table} where length=${oldLength};" | tail -3 | head -1 | xargs`), 10);

      await I.verifyCommand(`docker exec ${pgsqlContainerName} psql -U postgres -d dvdrental -c "delete from film_testing_${table} where length=${oldLength};"`);
      for (let j = 0; j < count; j++) {
        await I.verifyCommand(`docker exec ${pgsqlContainerName} psql -U postgres -d dvdrental -c "insert into film_testing_${table} values (${j}, 'title for ${j}', 'Description for ${j}', ${oldLength});"`);
      }

      await I.verifyCommand(`docker exec ${pgsqlContainerName} psql -U postgres -d dvdrental -c "update film_testing_${table} set length=${newLength} where length=${oldLength};"`);
      I.wait(5);
    }

    await I.amOnPage(I.buildUrlWithParams(experimentalPostgresqlDashboardsPage.vacuumDashboardPostgres.url, {
      service_name: pgsqlContainerName,
      from: 'now-5m',
    }));
    await I.waitForVisible(experimentalPostgresqlDashboardsPage.elements.barWithValue, 300);

    const output = await I.verifyCommand(`sudo docker exec ${pgsqlContainerName} psql -U postgres -d dvdrental -c 'SELECT tablename FROM pg_catalog.pg_tables;'`);
    const allTables = output.split(/\r?\n/);

    await experimentalPostgresqlDashboardsPage.vacuumAnalyzeTables(allTables, pgsqlContainerName);
    await experimentalPostgresqlDashboardsPage.waitForLastVacuumValues(600);
    await experimentalPostgresqlDashboardsPage.waitForLastAnalyzeValues(600);
  },
);
