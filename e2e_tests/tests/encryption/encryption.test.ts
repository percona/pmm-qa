import { readFileSync } from 'node:fs';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { APIRequestContext, expect, request as playwrightRequest } from '@playwright/test';
import Api from '@api/api';
import { S3LocationConfig } from '@api/backups.api';
import { encryptedValue } from '@helpers/encryption.helper';
import { ServiceType } from '@interfaces/inventory';

pmmTest.describe.configure({ mode: 'default' });

const serverKeyCommand = 'docker exec pmm-server cat /srv/pmm-encryption.key';
const nonDefaultKeyCommand = 'docker exec pmm-server-encryption cat /srv/non-default.key';
const serverRotationCommand = 'docker exec pmm-server pmm-encryption-rotation';
const rotationMessages = [
  'Added new primary encryption key',
  'Restarting PMM Server',
  'All stored secrets are re-encrypted with the new key',
];
let nodeId = '';

pmmTest.beforeAll(async ({ cliHelper }) => {
  cliHelper
    .execute('docker compose -f docker-compose.yml up -d --wait pmm-server-encryption postgres')
    .assertSuccess();
});

pmmTest.afterEach(async ({ api }) => {
  if (nodeId) await api.inventoryApi.deleteNode(nodeId, true);

  nodeId = '';
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
  async ({ api, cliHelper, credentials, dockerHelper }) => {
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

    // pmm-agent keeps running an exporter whose parameters did not change, so restart it for the fresh
    // sample to come from an exporter started with the post-rotation parameters.
    dockerHelper.supervisorctl('restart', 'pmm-agent');
    await api.prometheusApi.waitForNewValue(`pg_up{service_name="${serviceName}"}`, 1);

    expect(
      cliHelper.execute(agentsCommand).assertSuccess().stdout.trim(),
      'The agents credentials must be re-encrypted',
    ).not.toBe(agentsBeforeRotation);
  },
);

pmmTest(
  'PMM-T2094 Verify MySQL TLS monitoring survives encryption key rotation without corrupting stored certificates @fb-encryption',
  async ({ api, cliHelper, credentials, dockerHelper }) => {
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

    dockerHelper.supervisorctl('restart', 'pmm-agent');
    await api.prometheusApi.waitForNewValue(`mysql_up{service_name="${serviceName}"}`, 1);

    expect(
      cliHelper.execute(certLengthsCommand).assertSuccess().stdout.trim(),
      'mysql_options tls_cert/tls_key length must not change after encryption key rotation (PMM-15188)',
    ).toBe(lengthsBeforeRotation);
  },
);

pmmTest.describe('Valkey TLS and S3 location secrets', () => {
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
  const s3ChangedConfig: S3LocationConfig = {
    ...s3Config,
    access_key: 'pmm-encryption-access-2',
    secret_key: 'pmm-encryption-secret-2',
  };
  const valkeyTls = { ca: '', cert: '', key: '' };
  let artifactId = '';
  let locationId = '';
  let upgradeRequest: APIRequestContext | undefined;
  let upgradeVolume = '';

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

    cliHelper.execute('docker compose -f docker-compose.yml up -d --wait minio-encryption').assertSuccess();
    // Valkey reads its certificates on start only, and they were just regenerated.
    cliHelper
      .execute('docker compose -f docker-compose.yml up -d --wait --force-recreate valkey-encryption')
      .assertSuccess();
    await expect(() =>
      cliHelper
        .execute(
          `docker exec minio-encryption sh -c "mc alias set local http://127.0.0.1:9000 ${s3Config.access_key} ${s3Config.secret_key} && mc mb --ignore-existing local/${s3Config.bucket_name} && mc admin user add local ${s3ChangedConfig.access_key} ${s3ChangedConfig.secret_key} && mc admin policy attach local readwrite --user ${s3ChangedConfig.access_key}"`,
        )
        .assertSuccess(),
    ).toPass({ intervals: [Timeouts.TWO_SECONDS], timeout: Timeouts.ONE_MINUTE });
  });

  pmmTest.afterEach(async ({ api, cliHelper }) => {
    if (artifactId) await api.backupsApi.removeArtifact(artifactId);
    // Forced, as a backup that failed to start still leaves an artifact on the location.
    if (locationId) await api.backupsApi.removeLocation(locationId, true);
    if (upgradeRequest) {
      await upgradeRequest.dispose();
      cliHelper.execute(`${upgradeCompose} rm -sfv ${upgradeContainer}`).assertSuccess();

      // Once the upgrade recreates the container, it mounts the volume by name, so rm -v leaves it behind.
      if (upgradeVolume) cliHelper.execute(`docker volume rm -f ${upgradeVolume}`).assertSuccess();
    }

    artifactId = '';
    locationId = '';
    upgradeRequest = undefined;
    upgradeVolume = '';
  });

  pmmTest(
    'PMM-T2889 - Verify Valkey TLS certificate and key are encrypted at rest while the CA stays readable @fb-encryption',
    async ({ api, encryptionHelper }) => {
      const serviceName = `valkey_tls_encryption_${Math.floor(Math.random() * 99) + 1}`;
      const service = await api.managementApi.addRemoteValkeyTls(serviceName, valkeyContainer, valkeyTls);

      nodeId = service.node_id;
      await api.prometheusApi.waitForNewValue(`redis_up{service_name="${serviceName}"}`, 1);

      const stored = encryptionHelper.storedValkeyTls('pmm-server', service.service_id);

      expect(stored.ssl_cert, 'valkey_options ssl_cert must be stored encrypted').toMatch(encryptedValue);
      expect(stored.ssl_key, 'valkey_options ssl_key must be stored encrypted').toMatch(encryptedValue);
      expect(stored.ssl_ca, 'valkey_options ssl_ca must be stored as plaintext, unchanged').toBe(
        valkeyTls.ca,
      );
    },
  );

  pmmTest(
    'PMM-T2890 - Verify S3 backup location access and secret keys are encrypted at rest and returned decrypted by the API @fb-encryption',
    async ({ api, encryptionHelper }) => {
      locationId = await api.backupsApi.addS3Location(
        `s3_encryption_${Math.floor(Math.random() * 99) + 1}`,
        'Encryption test location',
        s3Config,
      );

      const stored = encryptionHelper.storedS3Config('pmm-server', locationId);

      expect(stored.access_key, 's3_config access_key must be stored encrypted').toMatch(encryptedValue);
      expect(stored.secret_key, 's3_config secret_key must be stored encrypted').toMatch(encryptedValue);
      expect(stored.endpoint, 's3_config endpoint must stay plaintext').toBe(s3Config.endpoint);
      expect(stored.bucket_name, 's3_config bucket_name must stay plaintext').toBe(s3Config.bucket_name);

      const location = (await api.backupsApi.getLocations()).find(
        ({ location_id }) => location_id === locationId,
      );

      expect(location?.s3_config, 'The locations API must return the decrypted S3 config').toEqual(s3Config);
    },
  );

  pmmTest(
    'PMM-T2891 - Verify changing S3 backup location keys stores the new keys encrypted @fb-encryption',
    async ({ api, encryptionHelper }) => {
      const name = `s3_change_${Math.floor(Math.random() * 99) + 1}`;

      locationId = await api.backupsApi.addS3Location(name, 'Encryption test location', s3Config);
      await api.backupsApi.changeLocation(locationId, name, 'Encryption test location', s3ChangedConfig);

      const stored = encryptionHelper.storedS3Config('pmm-server', locationId);

      expect(stored.access_key, 'The changed access_key must be stored encrypted').toMatch(encryptedValue);
      expect(stored.secret_key, 'The changed secret_key must be stored encrypted').toMatch(encryptedValue);

      const location = (await api.backupsApi.getLocations()).find(
        ({ location_id }) => location_id === locationId,
      );

      expect(location?.s3_config, 'The locations API must return the changed keys decrypted').toEqual(
        s3ChangedConfig,
      );
    },
  );

  pmmTest(
    'PMM-T2892 - Verify changing the Valkey exporter TLS certificate and key stores the new ones encrypted @fb-encryption',
    async ({ api, encryptionHelper, tlsHelper }) => {
      const serviceName = `valkey_tls_change_${Math.floor(Math.random() * 99) + 1}`;
      // Valkey refuses a client certificate its CA did not sign, so only the changed one can connect.
      const service = await api.managementApi.addRemoteValkeyTls(
        serviceName,
        valkeyContainer,
        { ...valkeyTls, ...tlsHelper.generateSelfSignedCertificate('pmm-encryption-untrusted') },
        { skipConnectionCheck: true },
      );

      nodeId = service.node_id;
      await api.prometheusApi.waitForNewValue(`redis_up{service_name="${serviceName}"}`, 0);

      const { agent_id: agentId } = await api.inventoryApi.getServiceExporter(
        service.service_id,
        'valkey_exporter',
      );
      const before = encryptionHelper.storedValkeyTls('pmm-server', service.service_id);

      await api.inventoryApi.changeAgent(agentId, {
        valkey_exporter: { tls_cert: valkeyTls.cert, tls_key: valkeyTls.key },
      });

      const after = encryptionHelper.storedValkeyTls('pmm-server', service.service_id);

      expect(after.ssl_cert, 'The changed ssl_cert must be stored encrypted').toMatch(encryptedValue);
      expect(after.ssl_key, 'The changed ssl_key must be stored encrypted').toMatch(encryptedValue);
      expect(after.ssl_cert, 'ssl_cert must be rewritten').not.toBe(before.ssl_cert);
      expect(after.ssl_key, 'ssl_key must be rewritten').not.toBe(before.ssl_key);
      expect(after.ssl_ca, 'ssl_ca must stay plaintext and unchanged').toBe(valkeyTls.ca);
      await api.prometheusApi.waitForNewValue(`redis_up{service_name="${serviceName}"}`, 1);
    },
  );

  pmmTest(
    'PMM-T2893 - Verify encryption key rotation re-encrypts Valkey TLS and S3 location secrets @fb-encryption',
    async ({ api, cliHelper, dockerHelper, encryptionHelper }) => {
      const serviceName = `valkey_tls_rotation_${Math.floor(Math.random() * 99) + 1}`;
      const service = await api.managementApi.addRemoteValkeyTls(serviceName, valkeyContainer, valkeyTls);

      nodeId = service.node_id;
      locationId = await api.backupsApi.addS3Location(
        `s3_rotation_${Math.floor(Math.random() * 99) + 1}`,
        'Encryption test location',
        s3Config,
      );
      await api.prometheusApi.waitForNewValue(`redis_up{service_name="${serviceName}"}`, 1);

      const tlsBefore = encryptionHelper.storedValkeyTls('pmm-server', service.service_id);
      const s3Before = encryptionHelper.storedS3Config('pmm-server', locationId);

      expect(tlsBefore.ssl_cert, 'ssl_cert must be encrypted before rotation').toMatch(encryptedValue);

      const keyIdBefore = encryptionHelper.keyId(tlsBefore.ssl_cert);

      for (const value of [tlsBefore.ssl_key, s3Before.access_key, s3Before.secret_key]) {
        expect(value, 'Every secret must be encrypted before rotation').toMatch(encryptedValue);
        expect(encryptionHelper.keyId(value), 'All secrets must be encrypted with the same primary key').toBe(
          keyIdBefore,
        );
      }

      const rotation = cliHelper.execute(serverRotationCommand).assertSuccess();

      for (const message of rotationMessages) {
        expect(rotation.stderr, 'Encryption key rotation output').toContain(message);
      }

      const newKeyId = Number(/Added new primary encryption key (\d+)/.exec(rotation.stderr)?.[1]);

      expect(newKeyId, 'Rotation must add a new primary key').not.toBe(keyIdBefore);

      const tlsAfter = encryptionHelper.storedValkeyTls('pmm-server', service.service_id);
      const s3After = encryptionHelper.storedS3Config('pmm-server', locationId);

      for (const [name, value] of Object.entries({
        access_key: s3After.access_key,
        secret_key: s3After.secret_key,
        ssl_cert: tlsAfter.ssl_cert,
        ssl_key: tlsAfter.ssl_key,
      })) {
        expect(value, `${name} must stay encrypted after rotation`).toMatch(encryptedValue);
        expect(encryptionHelper.keyId(value), `${name} must be re-encrypted with the new key`).toBe(newKeyId);
      }

      expect(tlsAfter.ssl_ca, 'ssl_ca must stay plaintext and unchanged').toBe(valkeyTls.ca);

      const location = (await api.backupsApi.getLocations()).find(
        ({ location_id }) => location_id === locationId,
      );

      expect(location?.s3_config, 'The S3 config must decrypt after rotation').toEqual(s3Config);
      dockerHelper.supervisorctl('restart', 'pmm-agent');
      await api.prometheusApi.waitForNewValue(`redis_up{service_name="${serviceName}"}`, 1);
    },
  );

  pmmTest(
    'PMM-T2894 - Verify a MySQL backup to an S3 location with encrypted keys succeeds after encryption key rotation @fb-encryption',
    async ({ api, cliHelper }) => {
      const { service_id: serviceId } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
        ServiceType.mysql,
        'ps_pmm_',
      );

      locationId = await api.backupsApi.addS3Location(
        `s3_backup_${Math.floor(Math.random() * 99) + 1}`,
        'Encryption test location',
        s3Config,
      );
      cliHelper.execute(serverRotationCommand).assertSuccess();
      await expect(async () => {
        const { agents } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
          ServiceType.mysql,
          'ps_pmm_',
        );

        expect(
          agents.find(({ agent_type }) => agent_type === 'pmm-agent')?.is_connected,
          'The pmm-agent of the PS container must reconnect after the rotation',
        ).toBe(true);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      artifactId = await api.backupsApi.startBackup(
        `encryption_backup_${Math.floor(Math.random() * 99) + 1}`,
        serviceId,
        locationId,
        { data_model: 'DATA_MODEL_PHYSICAL' },
      );
      await api.backupsApi.verifyBackupSuccess(artifactId);
    },
  );

  pmmTest(
    'PMM-T2895 - Verify PMM Server logs do not contain S3 location keys or the Valkey TLS key @fb-encryption',
    async ({ api, encryptionHelper }) => {
      const locationName = `s3_logs_${Math.floor(Math.random() * 99) + 1}`;
      const serviceName = `valkey_tls_logs_${Math.floor(Math.random() * 99) + 1}`;

      nodeId = (await api.managementApi.addRemoteValkeyTls(serviceName, valkeyContainer, valkeyTls)).node_id;
      locationId = await api.backupsApi.addS3Location(locationName, 'Encryption test location', s3Config);
      await api.backupsApi.changeLocation(
        locationId,
        locationName,
        'Encryption test location',
        s3ChangedConfig,
      );
      // The exporter runs once pmm-managed has sent its TLS files to pmm-agent, a request it logs too.
      await api.prometheusApi.waitForNewValue(`redis_up{service_name="${serviceName}"}`, 1);
      // The one response that carries the decrypted keys.
      await api.backupsApi.getLocations();

      for (const name of [locationName, serviceName]) {
        expect(
          encryptionHelper.logFilesContaining('pmm-server', [name]),
          `The request that carried the secrets of "${name}" must be logged`,
        ).toContain('/srv/logs/pmm-managed.log');
      }

      expect(
        encryptionHelper.logFilesContaining('pmm-server', [
          s3Config.access_key,
          s3Config.secret_key,
          s3ChangedConfig.access_key,
          s3ChangedConfig.secret_key,
          // A line of the key's base64 body, past the prefix every RSA key shares.
          valkeyTls.key.split('\n')[2],
        ]),
        'No log may contain an S3 key or the Valkey TLS key',
      ).toEqual([]);
    },
  );

  pmmTest(
    'PMM-T2896 - Verify upgrade encrypts Valkey TLS and S3 location secrets an older PMM stored as plaintext @fb-encryption',
    async ({ cliHelper, dockerHelper, encryptionHelper }) => {
      const serviceName = `valkey_tls_upgrade_${Math.floor(Math.random() * 99) + 1}`;
      const targetImage = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';

      upgradeRequest = await playwrightRequest.newContext({
        baseURL: 'https://127.0.0.1:4443',
        ignoreHTTPSErrors: true,
      });

      const upgradeApi = new Api(upgradeRequest);

      cliHelper.execute(`${upgradeCompose} up -d --wait ${upgradeContainer}`).assertSuccess();
      upgradeVolume = dockerHelper.getContainerVolume(upgradeContainer, '/srv');
      await expect(async () => {
        const { pmm_agent: pmmAgents } = await upgradeApi.inventoryApi.getAgents();

        expect(pmmAgents?.find(({ agent_id }) => agent_id === 'pmm-server')?.connected).toBe(true);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

      const service = await upgradeApi.managementApi.addRemoteValkeyTls(
        serviceName,
        valkeyContainer,
        valkeyTls,
      );
      const upgradeLocationId = await upgradeApi.backupsApi.addS3Location(
        `s3_upgrade_${Math.floor(Math.random() * 99) + 1}`,
        'Encryption test location',
        s3Config,
      );

      await upgradeApi.prometheusApi.waitForNewValue(`redis_up{service_name="${serviceName}"}`, 1);

      expect(
        encryptionHelper.storedValkeyTls(upgradeContainer, service.service_id).ssl_cert,
        'The older PMM must store ssl_cert as plaintext',
      ).toBe(valkeyTls.cert);
      expect(
        encryptionHelper.storedS3Config(upgradeContainer, upgradeLocationId).access_key,
        'The older PMM must store access_key as plaintext',
      ).toBe(s3Config.access_key);

      cliHelper
        .execute(`ENCRYPTION_UPGRADE_IMAGE=${targetImage} ${upgradeCompose} up -d --wait ${upgradeContainer}`)
        .assertSuccess();

      const tlsAfter = encryptionHelper.storedValkeyTls(upgradeContainer, service.service_id);
      const s3After = encryptionHelper.storedS3Config(upgradeContainer, upgradeLocationId);

      expect(tlsAfter.ssl_cert, 'ssl_cert must be encrypted by the upgrade').toMatch(encryptedValue);
      expect(tlsAfter.ssl_key, 'ssl_key must be encrypted by the upgrade').toMatch(encryptedValue);
      expect(tlsAfter.ssl_ca, 'ssl_ca must stay plaintext and unchanged').toBe(valkeyTls.ca);
      expect(s3After.access_key, 'access_key must be encrypted by the upgrade').toMatch(encryptedValue);
      expect(s3After.secret_key, 'secret_key must be encrypted by the upgrade').toMatch(encryptedValue);
      expect(
        cliHelper
          .execute(
            `docker exec ${upgradeContainer} sh -c 'stat -c %a /srv/pmm-encryption-migration-backup-*.json'`,
          )
          .assertSuccess()
          .stdout.trim(),
        'The migration backup must be written next to the key file, readable by its owner only',
      ).toBe('600');

      const location = (await upgradeApi.backupsApi.getLocations()).find(
        ({ location_id }) => location_id === upgradeLocationId,
      );

      expect(location?.s3_config, 'The migrated S3 config must decrypt to the original values').toEqual(
        s3Config,
      );
      await upgradeApi.prometheusApi.waitForNewValue(`redis_up{service_name="${serviceName}"}`, 1);
    },
  );
});
