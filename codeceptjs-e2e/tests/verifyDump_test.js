const assert = require('assert');

const { I } = inject();

Feature('Tests for Dump Tool');

const hostVolume = `${process.cwd()}/tests/output/sftp/`;
const sftp = {
  username: 'foo',
  password: 'password',
  directory: '/upload/',
};

BeforeSuite(async ({ I, codeceptjsConfig }) => {
  await I.verifyCommand(`docker run --name sftp-server -v ${hostVolume}:/home/foo${sftp.directory} -p 2222:22 -d atmoz/sftp ${sftp.username}:${sftp.password}`);
  await I.wait(30);
  await I.verifyCommand(`sudo chmod 777 ${hostVolume}`);
});

AfterSuite(async ({ I, codeceptjsConfig }) => {
  await I.verifyCommand('docker rm --force sftp-server || true');
  await I.wait(10);
});
Before(async ({ I }) => {
  await I.Authorize();
  I.setRequestTimeout(60000);
});

Scenario(
  'PMM-T1835 - Create Dump Archive and Verify its successful in UI @dump',
  async ({ dumpAPI, dumpPage }) => {
    const resp = await dumpAPI.createDump([]);
    const uid = JSON.parse(JSON.stringify(resp));

    I.amOnPage(dumpPage.url);
    // Required wait as delete in previous test takes time to reload page content.
    I.wait(5);
    await dumpAPI.waitForDumpSucceed(uid.dump_id);
    dumpPage.verifyDumpVisible(uid.dump_id);
    await dumpAPI.deleteDump(uid.dump_id);
  },
);

Scenario(
  'PMM-T1835 - Verify Edit Buttons are Enabled for Dump @dump',
  async ({ dumpAPI, dumpPage }) => {
    const resp = await dumpAPI.createDump([]);
    const uid = JSON.parse(JSON.stringify(resp));

    await dumpAPI.waitForDumpSucceed(uid.dump_id);

    I.amOnPage(dumpPage.url);
    // Required wait as delete in previous test takes time to reload page content.
    I.wait(5);
    await I.click(dumpPage.fields.status(uid.dump_id));
    dumpPage.verifyDownloadEnabled();
    dumpPage.verifyDeleteEnabled();
    dumpPage.verifySFTPEnabled();
    await dumpAPI.deleteDump(uid.dump_id);
  },
);

Scenario(
  'PMM-T1835 - Download and Verify Dump Archive with QAN enabled @dump',
  async ({ dumpAPI, dumpPage, I }) => {
    const resp = await dumpAPI.createDump([], true);
    const uid = JSON.parse(JSON.stringify(resp));

    await dumpAPI.waitForDumpSucceed(uid.dump_id);

    I.amOnPage(dumpPage.url);
    // Required wait as delete in previous test takes time to reload page content.
    I.wait(5);
    dumpPage.verifyDumpVisible(uid.dump_id);
    await dumpAPI.downloadDump(uid.dump_id);
    const result = await dumpAPI.verifyDump(uid.dump_id);

    I.assertEqual(
      2,
      result.isDir,
      `Expected 2 folders in the archive but found ${result.isDir}`,
    );
    I.assertEqual(
      2,
      result.isFile,
      `Expected 2 files in the archive but found ${result.isFile}`,
    );
    await dumpAPI.deleteDump(uid.dump_id);
  },
);

Scenario(
  'PMM-T1835 - Download and Verify Dump Archive with QAN disabled @dump',
  async ({ dumpAPI, dumpPage, I }) => {
    const resp = await dumpAPI.createDump([], false);
    const uid = JSON.parse(JSON.stringify(resp));

    await dumpAPI.waitForDumpSucceed(uid.dump_id);

    I.amOnPage(dumpPage.url);
    // Required wait as delete in previous test takes time to reload page content.
    I.wait(5);
    dumpPage.verifyDumpVisible(uid.dump_id);
    await dumpAPI.downloadDump(uid.dump_id);
    const result = await dumpAPI.verifyDump(uid.dump_id);

    I.assertEqual(
      1,
      result.isDir,
      `Expected 1 folders in the archive but found ${result.isDir}`,
    );
    I.assertEqual(
      2,
      result.isFile,
      `Expected 2 files in the archive but found ${result.isFile}`,
    );
    await dumpAPI.deleteDump(uid.dump_id);
  },
);

Scenario(
  'PMM-T1835 - Check Dump Archives can be sent to Support in UI @dump',
  async ({ dumpAPI, dumpPage }) => {
    const resp = await dumpAPI.createDump([]);
    const uid = JSON.parse(JSON.stringify(resp));

    await dumpAPI.waitForDumpSucceed(uid.dump_id);

    I.amOnPage(dumpPage.url);
    // Required wait as delete in previous test takes time to reload page content.
    I.wait(5);
    await I.click(dumpPage.fields.status(uid.dump_id));
    dumpPage.verifySFTPEnabled();
    await I.click(dumpPage.fields.sendSupportButton);

    // Get host ip and add it to know_hosts file on the host.
    const hostName = await I.verifyCommand('hostname -I | awk -F \' \' \'{print $1}\'');

    await I.verifyCommand(`ssh-keyscan -H ${hostName} >> ~/.ssh/known_hosts || true`);
    sftp.address = `${hostName}:2222`;
    dumpPage.verifySFTP(sftp);
    await dumpAPI.extractDump(uid.dump_id, hostVolume);

    const result = await dumpAPI.verifyDump(uid.dump_id, hostVolume);

    I.assertEqual(
      2,
      result.isDir,
      `Expected 2 folders in the archive but found ${result.isDir}`,
    );
    I.assertEqual(
      2,
      result.isFile,
      `Expected 2 files in the archive but found ${result.isFile}`,
    );
    await dumpAPI.deleteDump(uid.dump_id);
  },
);
Scenario(
  'PMM-T1835 - Verify Dump extraction logs are visible @dump',
  async ({ dumpAPI, dumpPage }) => {
    const resp = await dumpAPI.createDump([]);
    const uid = JSON.parse(JSON.stringify(resp));

    await dumpAPI.waitForDumpSucceed(uid.dump_id);

    I.amOnPage(dumpPage.url);
    // Required wait as delete in previous test takes time to reload page content.
    I.wait(5);
    dumpPage.verifyLogsVisible(uid.dump_id);
    await dumpAPI.deleteDump(uid.dump_id);
  },
);

Scenario(
  'PMM-T1835 - Verify details of Dump based on Service Name @dump',
  async ({ dumpAPI, dumpPage }) => {
    const resp = await dumpAPI.createDump(['pmm-server-postgresql']);
    const uid = JSON.parse(JSON.stringify(resp));

    await dumpAPI.waitForDumpSucceed(uid.dump_id);

    I.amOnPage(dumpPage.url);
    // Required wait as delete in previous test takes time to reload page content.
    I.wait(5);
    await dumpPage.verifyService(uid.dump_id);
    I.waitForText('pmm-server-postgresql');
    await dumpAPI.deleteDump(uid.dump_id);
  },
);
