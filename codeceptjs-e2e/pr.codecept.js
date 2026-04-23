const { Agent } = require('https');
const { pageObjects, getChunks } = require('./codeceptConfigHelper');
const bootstrapHook = require('./tests/helper/hooks.js');

require('dotenv').config();

const pmmUrl = process.env.PMM_UI_URL ? process.env.PMM_UI_URL : 'http://localhost/';

process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

exports.config = {
  output: 'tests/output',
  helpers: {
    Playwright: {
      // Replaces last forward slash in url due to bug of duplicate slashes
      url: pmmUrl.replace(/\/(?!.*\/)$/gm, ''),
      restart: true,
      show: false,
      trace: true,
      keepTraceForPassedTests: false,
      browser: 'chromium',
      windowSize: '1920x1080',
      timeout: 20000,
      waitForNavigation: 'load',
      waitForTimeout: 60000,
      getPageTimeout: 60000,
      waitForAction: 500,
      pressKeyDelay: 5,
      chromium: {
        executablePath: process.env.CHROMIUM_PATH,
        ignoreHTTPSErrors: true,
        args: [
          '--ignore-certificate-errors',
          '--no-sandbox',
          '--window-size=1920,1080',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
        ],
      },
    },
    MongoDBHelper: {
      require: './tests/helper/mongoDB.js',
      host: '127.0.0.1',
      port: 27017,
      username: 'root',
      password: 'root-!@#%^password',
    },
    PostgresqlDBHelper: {
      require: 'codeceptjs-postgresqlhelper',
      host: '127.0.0.1',
      port: 5433,
      user: 'postgres',
      password: 'pmm-^*&@agent-password',
      database: 'postgres',
    },
    Grafana: {
      require: './tests/helper/grafana_helper.js',
      username: process.env.GRAFANA_USERNAME,
      password: process.env.GRAFANA_PASSWORD,
    },
    FileHelper: {
      require: './tests/helper/file_helper.js',
    },
    FileSystem: {},
    PerformanceHelper: {
      require: './tests/helper/performance_helper.js',
    },
    BrowserHelper: {
      require: './tests/helper/browser_helper.js',
    },
    REST: {
      endpoint: process.env.PMM_UI_URL || pmmUrl,
      timeout: 60000,
      httpsAgent: new Agent({
        rejectUnauthorized: false,
      }),
    },
    Mailosaur: {
      require: 'codeceptjs-mailosaurhelper',
      apiKey: process.env.MAILOSAUR_API_KEY || 'key',
      serverId: process.env.MAILOSAUR_SERVER_ID || 'id',
      timeout: 15000,
    },
    DbHelper: {
      require: 'codeceptjs-dbhelper',
    },
    ChaiWrapper: {
      require: 'codeceptjs-chai',
    },
    LocalStorageHelper: {
      require: './tests/helper/localStorageHelper.js',
    },
    ApiHelper: {
      require: './tests/helper/apiHelper.js',
    },
    ReporterHelper: {
      require: './tests/helper/reporter_helper.js',
    },
  },
  include: pageObjects,
  multiple: {
    parallel: {
      chunks: (files) => getChunks(files),
      browsers: ['chromium'],
    },
  },
  plugins: {
    autoDelay: {
      enabled: true,
    },
    customLocator: {
      enabled: true,
      strategy: 'css',
      attribute: 'data-testid',
      showActual: false,
    },
    tryTo: {
      enabled: true,
    },
  },
  mocha: {
    reporterOptions: {
      'codeceptjs-cli-reporter': {
        stdout: '-',
        options: {
          verbose: false,
          steps: false,
        },
      },
      'mocha-junit-reporter': {
        stdout: '-',
        options: {
          mochaFile: './tests/output/result.xml',
          antMode: true,
          outputs: true,
          jenkinsMode: true,
        },
      },
    },
  },
  bootstrap: bootstrapHook,
  teardown: null,
  hooks: [],
  gherkin: {},
  tests: 'tests/**/*_test.js',
  timeout: 2400,
  name: 'pmm-qa',
};
