class ReporterHelper extends Helper {
  // eslint-disable-next-line no-underscore-dangle
  async _afterSuite(suite) {
    try {
      if (process.env.CI) {
        const testCycleKey = process.env.ZEPHYR_TEST_CYCLE_KEY || 'PMM-R203';
        const successUploadTests = [];
        const failUploadTests = [];

        for await (const test of suite.tests) {
          const testCaseKeys = test.title.split(' - ')[0];
          let statusName;
          let resp;

          if (test.state === 'failed') {
            statusName = 'FAIL';
          } else if (test.state === 'passed') {
            statusName = 'PASS';
          }

          if (statusName) {
            for await (const testCaseKey of testCaseKeys.split(' + ')) {
              resp = await this.helpers.REST.sendPostRequest(
                'https://api.zephyrscale.smartbear.com/v2/testexecutions',
                {
                  projectKey: 'PMM',
                  testCaseKey,
                  testCycleKey,
                  statusName,
                  comment: test.err ? test.err.toString() : undefined,
                },
                { Authorization: `Bearer ${process.env.ZEPHYR_PMM_API_KEY}` },
              );

              if (resp && (resp.status === 200 || resp.status === 201)) {
                successUploadTests.push(testCaseKey);
              } else if (resp && resp.status >= 400) {
                failUploadTests.push({ key: testCaseKey, status: resp.statusText });
              }
            }
          }
        }

        if (successUploadTests.length > 0) {
          // eslint-disable-next-line no-console
          console.log(`Successfully uploaded test results for the tests: "${successUploadTests}" into test cycle: "${testCycleKey}".`);
        }

        if (failUploadTests.length > 0) {
          // eslint-disable-next-line no-console
          console.log(`Error while uploading tests results: "${JSON.stringify(failUploadTests)}".`);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Error while uploading tests results.');
    }
  }
}

module.exports = ReporterHelper;
