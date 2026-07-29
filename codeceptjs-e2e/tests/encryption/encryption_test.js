const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

const { I } = inject();

Feature('Encryption');
const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';

BeforeSuite(async ({ I }) => {
  await I.verifyCommand(`PMM_SERVER_IMAGE=${dockerVersion} docker compose -f docker-compose-encryption.yml up -d`);
});

Before(async ({ I }) => {
  await I.Authorize();
});

const verifyEncryptionRotation = async (container) => {
  const r = await I.verifyCommand(`docker exec ${container} pmm-encryption-rotation`, '', 'pass', true);

  assert.ok(r.includes('DB pmm-managed is successfully decrypted'), 'Failed to decrypt DB');
  assert.ok(r.includes('Rotating encryption key'), 'Failed to rotate encryption key');
  assert.ok(r.includes('New encryption key generated'), 'Failed to generate new encryption key');
  assert.ok(r.includes('DB pmm-managed is successfully encrypted'), 'Failed to encrypt DB');
  assert.ok(r.includes('Starting PMM Server'), 'Failed to start PMM Server after encryption key rotation');
};

Scenario(
  'PMM-T1947 verify user is able to rotate encryption key @fb-encryption',
  async ({
    I, pmmInventoryPage,
  }) => {
    I.amOnPage(pmmInventoryPage.url);
    const encryptionKey = await I.verifyCommand('docker exec pmm-server cat /srv/pmm-encryption.key');

    await verifyEncryptionRotation('pmm-server');
    const newEncryptionKey = await I.verifyCommand('docker exec pmm-server cat /srv/pmm-encryption.key');

    assert.ok(encryptionKey !== newEncryptionKey, 'New and old encryption keys are the same');
  },
);

Scenario(
  'PMM-T1984 Verify user is able to change the encryption key path using PMM_ENCRYPTION_KEY_PATH env variable @fb-encryption',
  async ({
    I, pmmInventoryPage,
  }) => {
    I.amOnPage(pmmInventoryPage.url);
    await I.verifyCommand('docker exec pmm-server-encryption cat /srv/pmm-encryption.key', null, 'fail');
    const encryptionKey = await I.verifyCommand('docker exec pmm-server-encryption cat /srv/non-default.key');

    assert.ok(encryptionKey, 'Failed to get encryption key from /srv/non-default.key');
    await verifyEncryptionRotation('pmm-server-encryption');

    const newEncryptionKey = await I.verifyCommand('docker exec pmm-server-encryption cat /srv/non-default.key');

    assert.ok(encryptionKey !== newEncryptionKey, 'New and old encryption keys are the same');
  },
);

Scenario(
  'PMM-T1985 Verify DB monitoring works after encryption key rotation @fb-encryption',
  async ({
    I, addInstanceAPI, pmmInventoryPage, remoteInstancesHelper, inventoryAPI, grafanaAPI,
  }) => {
    const serviceName = `pg_encryption_${Math.floor(Math.random() * 99) + 1}`;

    I.amOnPage(pmmInventoryPage.url);
    await addInstanceAPI.apiAddInstance(
      remoteInstancesHelper.instanceTypes.postgresql,
      serviceName,
      {
        host: 'postgres',
        username: 'postgres',
        password: 'pmm-^*&@agent-password',
      },
    );

    await grafanaAPI.checkMetricExist('pg_up', { type: 'service_name', value: serviceName }, 1);
    const encryptionKey = await I.verifyCommand('docker exec pmm-server cat /srv/pmm-encryption.key');

    assert.ok(encryptionKey, 'Failed to get encryption key from /srv/pmm-encryption.key');

    const info = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, serviceName);
    const pgRespBeforeRotation = await I.verifyCommand(`docker exec pmm-server psql -Upmm-managed -c "SELECT username, password FROM agents WHERE service_id='${info.service_id}';"`);

    await verifyEncryptionRotation('pmm-server');
    const newEncryptionKey = await I.verifyCommand('docker exec pmm-server cat /srv/pmm-encryption.key');

    assert.ok(encryptionKey !== newEncryptionKey, 'New and old encryption keys are the same');
    I.wait(120);
    await grafanaAPI.checkMetricExist('pg_up', { type: 'service_name', value: serviceName }, 1);
    const pgRespAfterRotation = await I.verifyCommand(`docker exec pmm-server psql -Upmm-managed -c "SELECT username, password FROM agents WHERE service_id='${info.service_id}';"`);

    assert.ok(pgRespBeforeRotation !== pgRespAfterRotation, 'The DB was not re-encrypted');
  },
);

// TODO: assign a TestRail/Xray test-case id (PMM-TXXXX) to this scenario.
Scenario(
  'PMM-15188 Verify MySQL TLS monitoring survives encryption key rotation without corrupting stored certificates @fb-encryption',
  async ({
    I, addInstanceAPI, pmmInventoryPage, inventoryAPI, grafanaAPI,
  }) => {
    // Regression coverage for PMM-15188: on every encryption key rotation the JSON
    // "option" columns (here agents.mysql_options) were re-encrypted during the
    // decrypt phase instead of being decrypted, stacking an extra encryption layer
    // each time (~80% length growth per cycle). tls_cert/tls_key eventually became
    // undecryptable and pmm-agent failed with
    // "tls: failed to find any PEM data in certificate input", breaking MySQL TLS
    // monitoring. This test adds a MySQL service WITH TLS, rotates the key twice and
    // asserts that monitoring keeps working and the stored certificates do not grow.
    const serviceName = `mysql_tls_encryption_${Math.floor(Math.random() * 99) + 1}`;
    const dbUser = 'pmm_encryption';
    const dbPass = 'pmm_encryption_pass1^';

    // The encryption feature build provisions a Percona Server 8.0 instance
    // (--database ps=8.0). Discover its container regardless of the version suffix.
    const mysqlContainer = (await I.verifyCommand('docker ps --format "{{.Names}}" --filter name=ps_pmm | head -1')).trim();

    assert.ok(mysqlContainer, 'Could not find a Percona Server (ps_pmm*) container to monitor over TLS');

    // MySQL 8.0 auto-generates TLS material in its data directory and enables TLS by default.
    const tlsCa = await I.verifyCommand(`docker exec ${mysqlContainer} cat /var/lib/mysql/ca.pem`);
    const tlsCert = await I.verifyCommand(`docker exec ${mysqlContainer} cat /var/lib/mysql/client-cert.pem`);
    const tlsKey = await I.verifyCommand(`docker exec ${mysqlContainer} cat /var/lib/mysql/client-key.pem`);

    // Create a dedicated TLS-only monitoring user. mysql_native_password keeps the
    // exporter connection simple and independent of caching_sha2 negotiation.
    const grantSql = `CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED WITH mysql_native_password BY '${dbPass}' REQUIRE SSL; GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD, BACKUP_ADMIN ON *.* TO '${dbUser}'@'%'; GRANT SELECT ON performance_schema.* TO '${dbUser}'@'%'; FLUSH PRIVILEGES;`;

    await I.verifyCommand(`docker exec ${mysqlContainer} mysql -uroot -pGRgrO9301RuF -e "${grantSql}"`);

    I.amOnPage(pmmInventoryPage.url);

    // Add the MySQL service WITH TLS so tls_cert/tls_key are stored (encrypted) in agents.mysql_options.
    await addInstanceAPI.addMysqlSSL({
      serviceName,
      address: mysqlContainer,
      port: 3306,
      username: dbUser,
      password: dbPass,
      cluster: 'mysql_encryption_cluster',
      tlsCAFile: tlsCa,
      tlsCertFile: tlsCert,
      tlsKeyFile: tlsKey,
    });

    // Monitoring works before rotation.
    await grafanaAPI.checkMetricExist('mysql_up', { type: 'service_name', value: serviceName });

    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MYSQL, serviceName);
    const certLenSql = `SELECT length(mysql_options->>'tls_cert'), length(mysql_options->>'tls_key') FROM agents WHERE service_id='${service_id}' AND agent_type='mysqld_exporter';`;
    const certLenCommand = `docker exec pmm-server psql -Upmm-managed -t -A -F',' -c "${certLenSql}"`;

    const lengthsBeforeRotation = (await I.verifyCommand(certLenCommand)).trim();

    // Guard against a vacuous pass: the certificates must actually be stored.
    assert.ok(
      /^[1-9][0-9]*,[1-9][0-9]*$/.test(lengthsBeforeRotation),
      `tls_cert/tls_key are not stored in mysql_options (got "${lengthsBeforeRotation}")`,
    );

    // Rotate the encryption key twice.
    await verifyEncryptionRotation('pmm-server');
    await verifyEncryptionRotation('pmm-server');

    // Wait for fresh scrapes and assert monitoring resumed AFTER rotation
    // (2-minute lookback so only post-rotation samples satisfy the check).
    I.wait(130);
    await grafanaAPI.checkMetricExist('mysql_up', { type: 'service_name', value: serviceName }, 2);

    const lengthsAfterRotation = (await I.verifyCommand(certLenCommand)).trim();

    // The core PMM-15188 assertion: repeated rotations must not add encryption layers.
    assert.strictEqual(
      lengthsAfterRotation,
      lengthsBeforeRotation,
      `mysql_options tls_cert/tls_key length changed after encryption key rotation (before: ${lengthsBeforeRotation}, after: ${lengthsAfterRotation}); encryption layers accumulated (PMM-15188)`,
    );
  },
).retry(1);
