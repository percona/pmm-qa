import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

const serverKeyCommand = 'docker exec pmm-server cat /srv/pmm-encryption.key';
const nonDefaultKeyCommand = 'docker exec pmm-server-encryption cat /srv/non-default.key';
const rotationMessages = [
  'DB pmm-managed is successfully decrypted',
  'Rotating encryption key',
  'New encryption key generated',
  'DB pmm-managed is successfully encrypted',
  'Starting PMM Server',
];

pmmTest.beforeAll(async ({ cliHelper }) => {
  cliHelper
    .execute('docker compose -f docker-compose.yml up -d --wait pmm-server-encryption postgres')
    .assertSuccess();
});

pmmTest('PMM-T1947 verify user is able to rotate encryption key @fb-encryption', async ({ cliHelper }) => {
  const encryptionKey = cliHelper.execute(serverKeyCommand).assertSuccess().stdout.trim();
  const rotation = cliHelper.execute('docker exec pmm-server pmm-encryption-rotation').assertSuccess();

  for (const message of rotationMessages) {
    expect(rotation.stderr, 'Encryption key rotation output').toContain(message);
  }

  expect(
    cliHelper.execute(serverKeyCommand).assertSuccess().stdout.trim(),
    'New and old encryption keys must differ',
  ).not.toBe(encryptionKey);
});

pmmTest(
  'PMM-T1984 Verify user is able to change the encryption key path using PMM_ENCRYPTION_KEY_PATH env variable @fb-encryption',
  async ({ cliHelper }) => {
    expect(
      cliHelper.execute('docker exec pmm-server-encryption cat /srv/pmm-encryption.key').code,
      'The default key path must not exist when PMM_ENCRYPTION_KEY_PATH is set',
    ).not.toBe(0);

    const encryptionKey = cliHelper.execute(nonDefaultKeyCommand).assertSuccess().stdout.trim();

    expect(encryptionKey, 'Encryption key must be read from /srv/non-default.key').not.toBe('');

    const rotation = cliHelper
      .execute('docker exec pmm-server-encryption pmm-encryption-rotation')
      .assertSuccess();

    for (const message of rotationMessages) {
      expect(rotation.stderr, 'Encryption key rotation output').toContain(message);
    }

    expect(
      cliHelper.execute(nonDefaultKeyCommand).assertSuccess().stdout.trim(),
      'New and old encryption keys must differ',
    ).not.toBe(encryptionKey);
  },
);

pmmTest(
  'PMM-T1985 Verify DB monitoring works after encryption key rotation @fb-encryption',
  async ({ api, cliHelper, credentials }) => {
    const serviceName = `pg_encryption_${Math.floor(Math.random() * 99) + 1}`;
    const { postgresql } = await api.managementApi.addService({
      postgresql: {
        add_node: { node_name: serviceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
        address: 'postgres',
        cluster: 'pgsql_clstr',
        password: credentials.postgresContainer.password,
        pmm_agent_id: 'pmm-server',
        port: 5_432,
        qan_postgresql_pgstatmonitor_agent: true,
        service_name: serviceName,
        tls_skip_verify: true,
        username: credentials.postgresContainer.username,
      },
    });

    await expect
      .poll(
        () => api.prometheusApi.instantQueryValue(`last_over_time(pg_up{service_name="${serviceName}"}[1m])`),
        {
          message: `pg_up for "${serviceName}" must be collected`,
          timeout: Timeouts.ONE_MINUTE,
        },
      )
      .toBeDefined();

    const encryptionKey = cliHelper.execute(serverKeyCommand).assertSuccess().stdout.trim();

    expect(encryptionKey, 'Encryption key must be read from /srv/pmm-encryption.key').not.toBe('');

    const agentsCommand = `docker exec pmm-server psql -Upmm-managed -c "SELECT username, password FROM agents WHERE service_id='${postgresql?.service.service_id}';"`;
    const agentsBeforeRotation = cliHelper.execute(agentsCommand).assertSuccess().stdout.trim();
    const rotation = cliHelper.execute('docker exec pmm-server pmm-encryption-rotation').assertSuccess();

    for (const message of rotationMessages) {
      expect(rotation.stderr, 'Encryption key rotation output').toContain(message);
    }

    expect(
      cliHelper.execute(serverKeyCommand).assertSuccess().stdout.trim(),
      'New and old encryption keys must differ',
    ).not.toBe(encryptionKey);

    const rotatedAt = await api.prometheusApi.waitForServerTime();

    await expect(async () => {
      expect(
        await api.prometheusApi.instantQueryValue(`min(timestamp(pg_up{service_name="${serviceName}"}))`),
        `"${serviceName}" must be scraped again after the key rotation`,
      ).toBeGreaterThan(rotatedAt);
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

    expect(
      cliHelper.execute(agentsCommand).assertSuccess().stdout.trim(),
      'The agents credentials must be re-encrypted',
    ).not.toBe(agentsBeforeRotation);
  },
);

pmmTest(
  'PMM-T2094 Verify MySQL TLS monitoring survives encryption key rotation without corrupting stored certificates @fb-encryption',
  async ({ api, cliHelper, credentials }) => {
    const serviceName = `mysql_tls_encryption_${Math.floor(Math.random() * 99) + 1}`;
    const dbUser = 'pmm_encryption';
    const dbPass = 'pmm_encryption_pass1^';
    const mysqlContainer = cliHelper
      .execute('docker ps --format "{{.Names}}" --filter name=ps_pmm | head -1')
      .assertSuccess()
      .stdout.trim();

    expect(mysqlContainer, 'A Percona Server (ps_pmm*) container must exist').not.toBe('');

    cliHelper
      .execute(
        `docker exec ${mysqlContainer} mysql -uroot -p${credentials.perconaServer.password} -e "CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED WITH mysql_native_password BY '${dbPass}' REQUIRE SSL; GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD, BACKUP_ADMIN ON *.* TO '${dbUser}'@'%'; GRANT SELECT ON performance_schema.* TO '${dbUser}'@'%'; FLUSH PRIVILEGES;"`,
      )
      .assertSuccess();

    const { mysql } = await api.managementApi.addService({
      mysql: {
        add_node: { node_name: serviceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
        address: mysqlContainer,
        cluster: 'mysql_encryption_cluster',
        password: dbPass,
        pmm_agent_id: 'pmm-server',
        port: 3_306,
        qan_mysql_perfschema: true,
        service_name: serviceName,
        tls: true,
        tls_ca: cliHelper
          .execute(`docker exec ${mysqlContainer} cat /var/lib/mysql/ca.pem`)
          .assertSuccess()
          .stdout.trim(),
        tls_cert: cliHelper
          .execute(`docker exec ${mysqlContainer} cat /var/lib/mysql/client-cert.pem`)
          .assertSuccess()
          .stdout.trim(),
        tls_key: cliHelper
          .execute(`docker exec ${mysqlContainer} cat /var/lib/mysql/client-key.pem`)
          .assertSuccess()
          .stdout.trim(),
        tls_skip_verify: true,
        username: dbUser,
      },
    });

    await expect
      .poll(
        () =>
          api.prometheusApi.instantQueryValue(`last_over_time(mysql_up{service_name="${serviceName}"}[1m])`),
        {
          message: `mysql_up for "${serviceName}" must be collected`,
          timeout: Timeouts.ONE_MINUTE,
        },
      )
      .toBeDefined();

    const certLengthsCommand = `docker exec pmm-server psql -Upmm-managed -t -A -F, -c "SELECT length(mysql_options->>'tls_cert'), length(mysql_options->>'tls_key') FROM agents WHERE service_id='${mysql?.service.service_id}' AND agent_type='mysqld_exporter';"`;
    const lengthsBeforeRotation = cliHelper.execute(certLengthsCommand).assertSuccess().stdout.trim();

    expect(lengthsBeforeRotation, 'tls_cert/tls_key must be stored in mysql_options').toMatch(
      /^[1-9][0-9]*,[1-9][0-9]*$/,
    );

    const firstRotation = cliHelper.execute('docker exec pmm-server pmm-encryption-rotation').assertSuccess();
    const secondRotation = cliHelper
      .execute('docker exec pmm-server pmm-encryption-rotation')
      .assertSuccess();

    for (const message of rotationMessages) {
      expect(firstRotation.stderr, 'First encryption key rotation output').toContain(message);
      expect(secondRotation.stderr, 'Second encryption key rotation output').toContain(message);
    }

    const rotatedAt = await api.prometheusApi.waitForServerTime();

    await expect(async () => {
      expect(
        await api.prometheusApi.instantQueryValue(`min(timestamp(mysql_up{service_name="${serviceName}"}))`),
        `"${serviceName}" must be scraped again after the key rotations`,
      ).toBeGreaterThan(rotatedAt);
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

    expect(
      cliHelper.execute(certLengthsCommand).assertSuccess().stdout.trim(),
      'mysql_options tls_cert/tls_key length must not change after encryption key rotation (PMM-15188)',
    ).toBe(lengthsBeforeRotation);
  },
);
