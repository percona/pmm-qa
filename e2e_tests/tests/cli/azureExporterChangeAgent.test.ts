import pmmTest from '@fixtures/pmmTest';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  pmmTest.beforeAll(async ({ api }) => {
    await api.settingsApi.enableAzureMonitoring();
  });

  // eslint-disable-next-line playwright/expect-expect -- Debug test
  pmmTest('@azure-integration', async ({ api }) => {
    console.log(await api.settingsApi.getSettings());
  });
});
