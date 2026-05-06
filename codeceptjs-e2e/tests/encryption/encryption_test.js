const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

const { I } = inject();

Feature('Encryption');

BeforeSuite(async ({ I }) => {
  await I.verifyCommand('docker compose -f docker-compose-encryption.yml up -d');
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
).retry(2);
