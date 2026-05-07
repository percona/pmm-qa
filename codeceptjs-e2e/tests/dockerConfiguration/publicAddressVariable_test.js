const assert = require('assert');

Feature('Tests for PMM_PUBLIC_ADDRESS environment variable');

const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const contanerName = 'pmm-server-public-address';
const publicIPs = new DataTable(['testCase', 'publicAddress']);
const basePmmUrl = 'http://127.0.0.1:8085/';

publicIPs.add(['PMM-T1173', '127.0.0.1']);
publicIPs.add(['PMM-T1173', '127.0.0.1:8443']);
publicIPs.add(['PMM-T1174', 'ec2-18-188-74-98.us-east-2.compute.amazonaws.com']);
publicIPs.add(['PMM-T1174', 'ec2-18-188-74-98.us-east-2.compute.amazonaws.com:8443']);

const runContainerWithPublicAddressVariable = async (I, publicAddress) => {
  await I.verifyCommand(`docker run -d --restart always -e PERCONA_TEST_PLATFORM_ADDRESS=https://check-dev.percona.com:443 -e PMM_ENABLE_INTERNAL_PG_QAN=1 -e PMM_PUBLIC_ADDRESS=${publicAddress} --publish 8085:8080 --publish 8443:8443 --name ${contanerName} ${dockerVersion}`);
  await I.wait(30);
};

const runContainerWithPublicAddressVariableUpgrade = async (I, publicAddress) => {
  await I.verifyCommand(`docker run -d --restart always -e PERCONA_TEST_PLATFORM_ADDRESS=https://check-dev.percona.com:443 -e PMM_ENABLE_INTERNAL_PG_QAN=1 -e PMM_PUBLIC_ADDRESS=${publicAddress} --publish 8085:8080 --publish 8443:8443 --name ${contanerName} percona/pmm-server:latest`);
  await I.verifyCommand(`docker exec --user root ${contanerName} yum update -y percona-release`);
  await I.verifyCommand(`docker exec ${contanerName} sed -i'' -e 's^/release/^/experimental/^' /etc/yum.repos.d/pmm2-server.repo`);
  await I.verifyCommand(`docker exec ${contanerName} percona-release enable percona experimental`);
  await I.verifyCommand(`docker exec ${contanerName} yum clean all`);
  await I.verifyCommand(`docker restart ${contanerName}`);
  await I.wait(30);
};

After(async ({ I, portalAPI }) => {
  await I.verifyCommand('docker stop pmm-server-public-address');
  await I.verifyCommand('docker rm pmm-server-public-address');
});

Data(publicIPs).Scenario(
  'PMM-T1173 + PMM-T1174 - Verify PMM_PUBLIC_ADDRESS env variable with IP @docker-configuration',
  async ({
    I, pmmSettingsPage, current,
  }) => {
    const { publicAddress } = current;

    await runContainerWithPublicAddressVariable(I, publicAddress);
    await I.Authorize('admin', 'admin', basePmmUrl);

    await I.amOnPage(basePmmUrl + pmmSettingsPage.advancedSettingsUrl);
    await I.waitForVisible(pmmSettingsPage.fields.publicAddressInput, 30);
    const setPublicAddress = await I.grabValueFrom(pmmSettingsPage.fields.publicAddressInput);

    assert.ok(setPublicAddress === publicAddress, 'Set public address does not equal to one specified in public address environment variable');
  },
);

Scenario.skip(
  'PMM-T1176 Verify PMM_PUBLIC_ADDRESS env variable after upgrade @docker-configuration',
  async ({
    I, pmmSettingsPage, homePage,
  }) => {
    const serverIP = '127.0.0.1';
    const basePmmUrl = `http://${serverIP}:8085/`;

    await runContainerWithPublicAddressVariableUpgrade(I, serverIP);
    await I.amOnPage(basePmmUrl + homePage.url);
    await I.waitForElement(homePage.fields.dashboardHeaderLocator, 60);
    const { versionMinor } = await homePage.getVersions();

    await homePage.upgradePMM(versionMinor, contanerName);

    await I.amOnPage(basePmmUrl + pmmSettingsPage.advancedSettingsUrl);
    await I.waitForVisible(pmmSettingsPage.fields.publicAddressInput, 30);
    const setPublicAddress = await I.grabValueFrom(pmmSettingsPage.fields.publicAddressInput);

    assert.ok(setPublicAddress === serverIP, 'Set public address does not equal to one specified in public address environment variable');
  },
);

Scenario(
  'PMM-T1177 - Verify PMM_PUBLIC_ADDRESS env variable can be updated @docker-configuration',
  async ({
    I, pmmSettingsPage,
  }) => {
    const serverIP = '127.0.0.1';
    const basePmmUrl = `http://${serverIP}:8085/`;

    await runContainerWithPublicAddressVariable(I, '127.0.0.5');
    await I.wait(30);
    await I.Authorize('admin', 'admin', basePmmUrl);
    await I.amOnPage(basePmmUrl + pmmSettingsPage.advancedSettingsUrl);
    await I.waitForVisible(pmmSettingsPage.fields.publicAddressInput, 30);
    await pmmSettingsPage.clearPublicAddress();
    await I.wait(10);
    await pmmSettingsPage.addPublicAddress('127.0.0.1');
    const setPublicAddress = await I.grabValueFrom(pmmSettingsPage.fields.publicAddressInput);

    assert.ok(setPublicAddress === serverIP, 'Set public address does not equal to one specified in public address environment variable');
  },
);
