import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect, request as playwrightRequest } from '@playwright/test';
import Api from '@api/api';
import CliHelper from '@helpers/cli.helper';
import { S3LocationConfig } from '@api/backups.api';

pmmTest.describe.configure({ mode: 'default' });

const serverKeyCommand = 'docker exec pmm-server cat /srv/pmm-encryption.key';
const nonDefaultKeyCommand = 'docker exec pmm-server-encryption cat /srv/non-default.key';
const serverRotationCommand = 'docker exec pmm-server pmm-encryption-rotation';
const rotationMessages = [
  'Added new primary encryption key',
  'Restarting PMM Server',
  'All stored secrets are re-encrypted with the new key',
];
const valkeyContainer = 'valkey-encryption';
const valkeyTlsDir = 'output/valkey-encryption-tls';
const upgradeContainer = 'pmm-server-encryption-upgrade';
const upgradeCompose = 'docker compose -f docker-compose.yml --profile encryption-upgrade';
const s3Config: S3LocationConfig = {
  access_key: 'pmm-encryption-access',
  bucket_name: 'pmm-encryption',
  endpoint: 'http://minio-encryption:9000',
  secret_key: 'pmm-encryption-secret',
};
// pmm-managed stores an encrypted value as this prefix followed by base64 of a Tink ciphertext.
const envelope = /^pmm1\$[A-Za-z0-9+/]+={0,2}$/;
const valkeyTls = { ca: '', cert: '', key: '' };
let nodeId = '';
let locationId = '';
let upgradeServerStarted = false;
const md5 = (value: string) => createHash('md5').update(value).digest('hex');
// Bytes 1-4 of a Tink ciphertext are the ID of the key that encrypted it.
const envelopeKeyId = (stored: string) => Buffer.from(stored.slice('pmm1$'.length), 'base64').readUInt32BE(1);

const addValkeyTlsService = async (api: Api, serviceName: string) => {
  const { valkey } = await api.managementApi.addService({
    valkey: {
      add_node: { node_name: serviceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
      address: valkeyContainer,
      pmm_agent_id: 'pmm-server',
      port: 6_379,
      service_name: serviceName,
      tls: true,
      tls_ca: valkeyTls.ca,
      tls_cert: valkeyTls.cert,
      tls_key: valkeyTls.key,
    },
  });

  expect(valkey?.service.service_id, `Valkey service "${serviceName}" must be added`).toBeTruthy();

  return { nodeId: valkey?.service.node_id ?? '', serviceId: valkey?.service.service_id ?? '' };
};

const storedValkeyTls = (cliHelper: CliHelper, container: string, serviceId: string) => {
  const [cert, key, caMd5] = cliHelper
    .execSilent(
      `docker exec ${container} psql -Upmm-managed -t -A -F'|' -c "SELECT valkey_options->>'ssl_cert', valkey_options->>'ssl_key', md5(valkey_options->>'ssl_ca') FROM agents WHERE service_id='${serviceId}' AND agent_type='valkey_exporter';"`,
    )
    .assertSuccess()
    .stdout.trim()
    .split('|');

  return { caMd5, cert, key };
};

const storedS3Config = (cliHelper: CliHelper, container: string, id: string) => {
  const [accessKey, secretKey, endpoint, bucketName] = cliHelper
    .execSilent(
      `docker exec ${container} psql -Upmm-managed -t -A -F'|' -c "SELECT s3_config->>'access_key', s3_config->>'secret_key', s3_config->>'endpoint', s3_config->>'bucket_name' FROM backup_locations WHERE id='${id}';"`,
    )
    .assertSuccess()
    .stdout.trim()
    .split('|');

  return { accessKey, bucketName, endpoint, secretKey };
};

const waitForValkeyScrape = async (api: Api, serviceName: string, after = 0) => {
  await expect(async () => {
    const samples = await api.prometheusApi.instantQuery(
      `timestamp(redis_up{service_name="${serviceName}"})`,
    );

    expect(samples.length, `redis_up for "${serviceName}" must be collected`).toBeGreaterThan(0);
    expect(Number(samples[0].value[1]), `"${serviceName}" must be scraped after ${after}`).toBeGreaterThan(
      after,
    );
    expect(
      await api.prometheusApi.instantQueryValue(`redis_up{service_name="${serviceName}"}`),
      `The exporter must connect to Valkey over TLS for "${serviceName}"`,
    ).toBe(1);
  }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
};

pmmTest.beforeAll(async ({ cliHelper }) => {
  cliHelper
    .execute(
      `mkdir -p ${valkeyTlsDir} && cd ${valkeyTlsDir} && ` +
        'openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=pmm-qa-encryption-ca -keyout ca.key -out ca.crt && ' +
        `openssl req -newkey rsa:2048 -nodes -subj /CN=${valkeyContainer} -keyout server.key -out server.csr && ` +
        `echo subjectAltName=DNS:${valkeyContainer} > server.ext && ` +
        'openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 2 -extfile server.ext -out server.crt && ' +
        'openssl req -newkey rsa:2048 -nodes -subj /CN=pmm-encryption-client -keyout client.key -out client.csr && ' +
        'openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 2 -out client.crt && ' +
        'chmod 644 *',
    )
    .assertSuccess();
  valkeyTls.ca = readFileSync(`${valkeyTlsDir}/ca.crt`, 'utf8');
  valkeyTls.cert = readFileSync(`${valkeyTlsDir}/client.crt`, 'utf8');
  valkeyTls.key = readFileSync(`${valkeyTlsDir}/client.key`, 'utf8');

  cliHelper
    .execute(
      'docker compose -f docker-compose.yml up -d --wait pmm-server-encryption postgres minio-encryption',
    )
    .assertSuccess();
  // Valkey reads its certificates on start only, and they were just regenerated.
  cliHelper
    .execute('docker compose -f docker-compose.yml up -d --wait --force-recreate valkey-encryption')
    .assertSuccess();
  await expect(() =>
    cliHelper
      .execute(
        `docker exec minio-encryption sh -c "mc alias set local http://127.0.0.1:9000 ${s3Config.access_key} ${s3Config.secret_key} && mc mb --ignore-existing local/${s3Config.bucket_name}"`,
      )
      .assertSuccess(),
  ).toPass({ intervals: [Timeouts.TWO_SECONDS], timeout: Timeouts.ONE_MINUTE });
});

pmmTest.afterEach(async ({ api, cliHelper }) => {
  if (nodeId) await api.inventoryApi.deleteNode(nodeId, true);
  if (locationId) await api.backupsApi.removeLocation(locationId);
  if (upgradeServerStarted) {
    cliHelper.execute(`${upgradeCompose} rm -sfv ${upgradeContainer}`).assertSuccess();
    cliHelper
      .execute(
        'docker volume rm $(docker volume ls -q --filter label=com.docker.compose.volume=pmm-encryption-upgrade-volume)',
      )
      .assertSuccess();
  }

  nodeId = '';
  locationId = '';
  upgradeServerStarted = false;
});

pmmTest('PMM-T1947 verify user is able to rotate encryption key @fb-encryption', async ({ cliHelper }) => {
  const encryptionKey = cliHelper.execute(serverKeyCommand).assertSuccess().stdout.trim();
  const rotation = cliHelper.execute(serverRotationCommand).assertSuccess();

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

    nodeId = postgresql?.service.node_id ?? '';

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
    const rotation = cliHelper.execute(serverRotationCommand).assertSuccess();

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

    const { ca, cert, key } = cliHelper.readMysqlTlsCertificates(mysqlContainer);
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
        tls_ca: ca,
        tls_cert: cert,
        tls_key: key,
        tls_skip_verify: true,
        username: dbUser,
      },
    });

    nodeId = mysql?.service.node_id ?? '';

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

    const firstRotation = cliHelper.execute(serverRotationCommand).assertSuccess();
    const secondRotation = cliHelper.execute(serverRotationCommand).assertSuccess();

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

pmmTest(
  'PMM-TXXXX - Verify Valkey TLS certificate and key are encrypted at rest while the CA stays readable @fb-encryption',
  async ({ api, cliHelper }) => {
    const serviceName = `valkey_tls_encryption_${Math.floor(Math.random() * 99) + 1}`;
    const valkey = await addValkeyTlsService(api, serviceName);

    nodeId = valkey.nodeId;

    await waitForValkeyScrape(api, serviceName);

    const stored = storedValkeyTls(cliHelper, 'pmm-server', valkey.serviceId);

    expect(stored.cert, 'valkey_options ssl_cert must be stored encrypted').toMatch(envelope);
    expect(stored.key, 'valkey_options ssl_key must be stored encrypted').toMatch(envelope);
    expect(stored.caMd5, 'valkey_options ssl_ca must be stored as plaintext, unchanged').toBe(
      md5(valkeyTls.ca),
    );
  },
);

pmmTest(
  'PMM-TXXXX - Verify S3 backup location access and secret keys are encrypted at rest and returned decrypted by the API @fb-encryption',
  async ({ api, cliHelper }) => {
    locationId = await api.backupsApi.addS3Location(
      `s3_encryption_${Math.floor(Math.random() * 99) + 1}`,
      'Encryption test location',
      s3Config,
    );

    const stored = storedS3Config(cliHelper, 'pmm-server', locationId);

    expect(stored.accessKey, 's3_config access_key must be stored encrypted').toMatch(envelope);
    expect(stored.secretKey, 's3_config secret_key must be stored encrypted').toMatch(envelope);
    expect(stored.endpoint, 's3_config endpoint must stay plaintext').toBe(s3Config.endpoint);
    expect(stored.bucketName, 's3_config bucket_name must stay plaintext').toBe(s3Config.bucket_name);

    const location = (await api.backupsApi.getLocations()).find(
      ({ location_id }) => location_id === locationId,
    );

    expect(location?.s3_config, 'The locations API must return the decrypted S3 config').toEqual(s3Config);
  },
);

pmmTest(
  'PMM-TXXXX - Verify encryption key rotation re-encrypts Valkey TLS and S3 location secrets @fb-encryption',
  async ({ api, cliHelper }) => {
    const serviceName = `valkey_tls_rotation_${Math.floor(Math.random() * 99) + 1}`;
    const valkey = await addValkeyTlsService(api, serviceName);

    nodeId = valkey.nodeId;
    locationId = await api.backupsApi.addS3Location(
      `s3_rotation_${Math.floor(Math.random() * 99) + 1}`,
      'Encryption test location',
      s3Config,
    );
    await waitForValkeyScrape(api, serviceName);

    const tlsBefore = storedValkeyTls(cliHelper, 'pmm-server', valkey.serviceId);
    const s3Before = storedS3Config(cliHelper, 'pmm-server', locationId);
    const keyIdBefore = envelopeKeyId(tlsBefore.cert);

    for (const value of [tlsBefore.key, s3Before.accessKey, s3Before.secretKey]) {
      expect(envelopeKeyId(value), 'All secrets must be encrypted with the same primary key').toBe(
        keyIdBefore,
      );
    }

    const rotation = cliHelper.execute(serverRotationCommand).assertSuccess();

    for (const message of rotationMessages) {
      expect(rotation.stderr, 'Encryption key rotation output').toContain(message);
    }

    const rotatedAt = await api.prometheusApi.waitForServerTime();
    const tlsAfter = storedValkeyTls(cliHelper, 'pmm-server', valkey.serviceId);
    const s3After = storedS3Config(cliHelper, 'pmm-server', locationId);
    const keyIdAfter = envelopeKeyId(tlsAfter.cert);

    expect(keyIdAfter, 'Secrets must be re-encrypted with a new primary key').not.toBe(keyIdBefore);

    for (const [name, value] of Object.entries({
      access_key: s3After.accessKey,
      secret_key: s3After.secretKey,
      ssl_cert: tlsAfter.cert,
      ssl_key: tlsAfter.key,
    })) {
      expect(value, `${name} must stay encrypted after rotation`).toMatch(envelope);
      expect(envelopeKeyId(value), `${name} must be re-encrypted with the new key`).toBe(keyIdAfter);
    }

    expect(tlsAfter.caMd5, 'ssl_ca must stay plaintext and unchanged').toBe(md5(valkeyTls.ca));

    const location = (await api.backupsApi.getLocations()).find(
      ({ location_id }) => location_id === locationId,
    );

    expect(location?.s3_config, 'The S3 config must decrypt after rotation').toEqual(s3Config);
    await waitForValkeyScrape(api, serviceName, rotatedAt);
  },
);

pmmTest(
  'PMM-TXXXX - Verify upgrade encrypts Valkey TLS and S3 location secrets an older PMM stored as plaintext @fb-encryption',
  async ({ cliHelper }) => {
    const serviceName = `valkey_tls_upgrade_${Math.floor(Math.random() * 99) + 1}`;
    const targetImage = process.env.DOCKER_VERSION ?? 'perconalab/pmm-server:3-dev-latest';
    const upgradeApi = new Api(
      await playwrightRequest.newContext({ baseURL: 'https://127.0.0.1:4443', ignoreHTTPSErrors: true }),
    );

    upgradeServerStarted = true;
    cliHelper.execute(`${upgradeCompose} up -d --wait ${upgradeContainer}`).assertSuccess();
    cliHelper
      .execute(
        `docker exec ${upgradeContainer} change-admin-password '${process.env.ADMIN_PASSWORD || 'admin'}'`,
      )
      .assertSuccess();
    await expect(async () => {
      const { pmm_agent: pmmAgents } = await upgradeApi.inventoryApi.getAgents();

      expect(pmmAgents?.find(({ agent_id }) => agent_id === 'pmm-server')?.connected).toBe(true);
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

    const valkey = await addValkeyTlsService(upgradeApi, serviceName);
    const upgradeLocationId = await upgradeApi.backupsApi.addS3Location(
      `s3_upgrade_${Math.floor(Math.random() * 99) + 1}`,
      'Encryption test location',
      s3Config,
    );

    await waitForValkeyScrape(upgradeApi, serviceName);

    const tlsBefore = storedValkeyTls(cliHelper, upgradeContainer, valkey.serviceId);
    const s3Before = storedS3Config(cliHelper, upgradeContainer, upgradeLocationId);

    expect(tlsBefore.cert, 'The older PMM must store ssl_cert as plaintext').toContain('BEGIN CERTIFICATE');
    expect(s3Before.accessKey, 'The older PMM must store access_key as plaintext').toBe(s3Config.access_key);

    cliHelper
      .execute(`ENCRYPTION_UPGRADE_IMAGE=${targetImage} ${upgradeCompose} up -d --wait ${upgradeContainer}`)
      .assertSuccess();

    const upgradedAt = await upgradeApi.prometheusApi.waitForServerTime(Timeouts.FIVE_MINUTES);
    const tlsAfter = storedValkeyTls(cliHelper, upgradeContainer, valkey.serviceId);
    const s3After = storedS3Config(cliHelper, upgradeContainer, upgradeLocationId);

    expect(tlsAfter.cert, 'ssl_cert must be encrypted by the upgrade').toMatch(envelope);
    expect(tlsAfter.key, 'ssl_key must be encrypted by the upgrade').toMatch(envelope);
    expect(tlsAfter.caMd5, 'ssl_ca must stay plaintext and unchanged').toBe(md5(valkeyTls.ca));
    expect(s3After.accessKey, 'access_key must be encrypted by the upgrade').toMatch(envelope);
    expect(s3After.secretKey, 'secret_key must be encrypted by the upgrade').toMatch(envelope);
    cliHelper
      .execute(`docker exec ${upgradeContainer} sh -c 'ls /srv/pmm-encryption-migration-backup-*.json'`)
      .assertSuccess();

    const location = (await upgradeApi.backupsApi.getLocations()).find(
      ({ location_id }) => location_id === upgradeLocationId,
    );

    expect(location?.s3_config, 'The migrated S3 config must decrypt to the original values').toEqual(
      s3Config,
    );
    await waitForValkeyScrape(upgradeApi, serviceName, upgradedAt);
  },
);
