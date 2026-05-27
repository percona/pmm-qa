const { I, codeceptjsConfig } = inject();
const assert = require('assert');
const axios = require('axios');
const fs = require('fs');
const targz = require('tar.gz');
const path = require('path');
const { pipeline } = require('stream/promises');
const { readdirSync } = require('fs');

const outputDir = `${process.cwd()}/tests/output/`;
const buildDumpDownloadUrl = (uid) => {
  const baseUrl = codeceptjsConfig.config.helpers.REST.endpoint;

  return new URL(`dump/${uid}.tar.gz`, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
};
const countFilesRecursively = (dir) => {
  const files = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...countFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

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
      enable_encryption: false,
      export_qan: Qan,
    };

    const resp = await I.sendPostRequest('v1/dumps:start', body, headers);

    assert.ok(resp.status === 200, `Failed to create Dump Archive. Response message is ${resp.data.message}`);

    return resp.data;
  },

  async downloadDump(uid) {
    const headers = { Authorization: `Basic ${await I.getAuth()}` };
    const targzFile = path.join(outputDir, `${uid}.tar.gz`);
    const destnDir = path.join(outputDir, uid);
    const response = await axios.get(buildDumpDownloadUrl(uid), {
      headers,
      responseType: 'stream',
      validateStatus: () => true,
    });

    assert.strictEqual(
      response.status,
      200,
      `Failed to download Dump Archive "${uid}". Response status is ${response.status} ${response.statusText}`,
    );

    await fs.promises.mkdir(outputDir, { recursive: true });
    await pipeline(response.data, fs.createWriteStream(targzFile));
    await targz().extract(targzFile, destnDir);

    return true;
  },

  async extractDump(uid, sftpDir) {
    const targzFile = `${sftpDir}/${uid}.tar.gz`;
    const destnDir = `${sftpDir}/${uid}`;

    await I.asyncWaitFor(async () => fs.existsSync(targzFile), 60);
    await targz().extract(targzFile, destnDir);
  },

  async verifyDump(uid, sftDir) {
    const absOutputDir = sftDir || outputDir;
    const destnDir = `${absOutputDir}/${uid}`;

    await I.asyncWaitFor(async () => fs.existsSync(destnDir), 60);
    const contents = readdirSync(destnDir, { withFileTypes: true });
    const dirs = contents.filter((entry) => entry.isDirectory());
    const files = countFilesRecursively(destnDir);

    return { dirs, files };
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
