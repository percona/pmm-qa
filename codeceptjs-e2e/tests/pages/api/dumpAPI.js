const { I } = inject();
const assert = require('assert');
const request = require('request');
const fs = require('fs');
const targz = require('tar.gz');
const path = require('path');
const { readdirSync } = require('fs');

const outputDir = `${process.cwd()}/tests/output/`;

module.exports = {
  async createDump(serviceName, Qan = true) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    const defaultTime = new Date();

    defaultTime.setMinutes(defaultTime.getMinutes() - 5);

    const body = {
      service_names: serviceName || [],
      start_time: new Date(defaultTime.toUTCString()),
      end_time: new Date(new Date().toUTCString()),
      ignore_load: true,
      export_qan: Qan,
    };

    const resp = await I.sendPostRequest('v1/dumps:start', body, headers);

    assert.ok(
      resp.status === 200,
      `Failed to create Dump Archive. Response message is ${resp.data.message}`,
    );

    return resp.data;
  },

  async downloadDump(uid) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const targzFile = `${outputDir}/${uid}.tar.gz`;
    const destnDir = `${outputDir}/${uid}`;

    return new Promise((resolve, reject) => {
      request.get(`${process.env.PMM_UI_URL}dump/${uid}.tar.gz`, { headers }, (error, response, body) => {
      }).pipe(fs.createWriteStream(targzFile))
        .on('close', () => {
          targz().extract(targzFile, destnDir);
          resolve(true);
        });
    });
  },

  async extractDump(uid, sftpDir) {
    const targzFile = `${sftpDir}/${uid}.tar.gz`;
    const destnDir = `${sftpDir}/${uid}`;

    await I.asyncWaitFor(async () => fs.existsSync(targzFile), 60);
    targz().extract(targzFile, destnDir);
  },

  async verifyDump(uid, sftDir) {
    const absOutputDir = sftDir || outputDir;
    const destnDir = `${absOutputDir}/${uid}`;

    await I.asyncWaitFor(async () => fs.existsSync(destnDir), 60);
    let isDir = 0; let
      isFile = 0;
    const contents = readdirSync(destnDir);

    contents.forEach((item) => {
      const fullPath = path.join(destnDir, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        isDir += 1;
      } else if (stats.isFile()) {
        isFile += 1;
      }
    });

    return { isDir, isFile };
  },

  async listDumps() {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    return I.sendGetRequest('v1/dumps', headers);
  },

  async getDump(uid) {
    const dump = await this.listDumps();
    const { dumps } = dump.data;

    return dumps.find((item) => item.dump_id === uid);
  },

  async waitForDumpSucceed(uid, timeout = 60) {
    await I.asyncWaitFor(async () => {
      const dumpObj = await this.getDump(uid);

      return dumpObj.status === 'DUMP_STATUS_SUCCESS';
    }, timeout);
  },

  async deleteDump(uid) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const body = JSON.stringify({ dump_ids: [uid] });

    return I.sendPostRequest('v1/dumps:batchDelete', body, headers);
  },

};
