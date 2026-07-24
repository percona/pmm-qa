const { I } = inject();
const BaseDashboardPage = require('../BaseDashboard');

module.exports = {
  ...BaseDashboardPage,
  url: '',
  elements: {
    barValue: '//div[@data-testid="data-testid Bar gauge value"]',
    barWithValue: locate('//div[@data-testid="data-testid Bar gauge value"]//span[text() > "0"]'),
    lastVacuumValue: '//div[contains(@class, "react-grid-item")][5]//div[contains(text(), "dvdrental")]//following-sibling::*',
    lastAnalyzeValue: '//div[contains(@class, "react-grid-item")][6]//div[contains(text(), "dvdrental")]//following-sibling::*',
  },
  fields: {},
  buttons: {},
  messages: {
  },
  vacuumDashboardPostgres: {
    url: 'graph/d/postgres_vacuum_monitoring/postgresql-vacuum-monitoring?orgId=1&refresh=10s',
  },

  async vacuumAnalyzeTables(tables, containerName) {
    for await (const table of tables.values()) {
      if (table.includes('film')
        || table.includes('actor')
        || table.includes('store')
        || table.includes('address')
        || table.includes('category')
        || table.includes('city')
        || table.includes('country')
        || table.includes('customer')
        || table.includes('inventory')
        || table.includes('language')
        || table.includes('rental')
        || table.includes('staff')
        || table.includes('payment')
      ) {
        await I.verifyCommand(`sudo docker exec ${containerName} psql -U postgres -d dvdrental -c 'VACUUM  ( ANALYZE ) ${table.trim()}'`);
      }
    }
  },

  async checkVacuumValues(element) {
    const lastVacuumValues = await I.grabTextFromAll(element);

    for await (const lastVacuumValue of lastVacuumValues.values()) {
      if (new Date(lastVacuumValue).toString() !== 'Invalid Date') {
        return true;
      }
    }

    return null;
  },

  async waitForLastVacuumValues(timeoutInSeconds) {
    await I.asyncWaitFor(async () => this.checkVacuumValues(this.elements.lastVacuumValue), timeoutInSeconds);
  },

  async waitForLastAnalyzeValues(timeoutInSeconds) {
    await I.asyncWaitFor(async () => this.checkVacuumValues(this.elements.lastAnalyzeValue), timeoutInSeconds);
  },
};
