const Helper = codecept_helper;
const assert = require('assert');
const fs = require('fs');

class FileHelper extends Helper {
  async writeFileSync(path, data, failOnError = true) {
    try {
      return fs.writeFileSync(path, data, { flag: 'w+' });
    } catch (e) {
      if (!failOnError) assert.ok(false, `Could not write into file: ${path}, because of error: ${e}`);
    }

    return null;
  }

  async readFileSync(path, failOnError = true) {
    try {
      return fs.readFileSync(path, 'utf8');
    } catch (e) {
      if (!failOnError) assert.ok(false, `Could not read file: ${path}, because of error: ${e}`);
    }

    return null;
  }

  async fileSize(path, failOnError = true) {
    try {
      const stats = fs.statSync(path);

      return stats.size;
    } catch (e) {
      if (!failOnError) assert.ok(false, `Could not get file size: ${path}, because of error: ${e}`);
    }

    return -1;
  }
}

module.exports = FileHelper;
