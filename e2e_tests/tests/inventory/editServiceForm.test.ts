import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';
import {
  formServices,
  formUserPassword,
  serviceEndpoint,
  serviceTypeLabels,
  toNotificationText,
  validationCases,
} from '@helpers/serviceForm.helper';
import { GetService } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const missingServiceId = '00000000-0000-4000-8000-000000000000';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

for (const { name, serviceRegex } of formServices) {
  pmmTest(
    `PMM-15674 - Verify Service block shows the type, node and address of ${name} service read-only @inventory`,
    async ({ api, editServicePage }) => {
      const service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);
      const endpoint = serviceEndpoint(service);

      await editServicePage.open(service.service_id);
      await expect(editServicePage.builders.title(service.service_name)).toBeVisible();
      await expect(editServicePage.elements.serviceDetails).toContainText(
        'These details cannot be changed here. To change them, remove the service and add it again.',
      );
      await expect(editServicePage.elements.serviceDetails).toContainText(
        serviceTypeLabels[service.service_type],
      );
      await expect(editServicePage.elements.serviceDetails).toContainText(service.node_name);
      await expect(editServicePage.elements.serviceDetails).toContainText(
        endpoint ? `${endpoint.label}${endpoint.value}` : 'Node',
      );
      await expect(
        editServicePage.elements.form.getByLabel(/^(Service name|Name|Node|Address|Port|Socket)$/),
        'no field edits the service name, node or endpoint',
      ).toHaveCount(0);
    },
  );
}

pmmTest(
  'PMM-15674 - Verify Edit action in the services list opens the edit page @inventory',
  async ({ api, editServicePage, page }) => {
    const service = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm');

    await editServicePage.openFromServicesList(service.service_name);
    await expect(page).toHaveURL(new RegExp(`${editServicePage.url}/${service.service_id}/edit$`));
    await expect(editServicePage.builders.title(service.service_name)).toBeVisible();
  },
);

pmmTest(
  'PMM-15674 - Verify old edit-instance links redirect to the edit page @inventory',
  async ({ api, editServicePage, page }) => {
    const service = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm');

    // The server sends a top-level /graph/ link to the PMM UI, whose router redirects both paths.
    for (const link of [
      `graph/edit-instance/${service.service_id}`,
      `pmm-ui/edit-instance/${service.service_id}`,
    ]) {
      await pmmTest.step(link, async () => {
        await page.goto(link);
        await expect(page).toHaveURL(new RegExp(`${editServicePage.url}/${service.service_id}/edit$`));
        await expect(editServicePage.builders.title(service.service_name)).toBeVisible();
      });
    }
  },
);

pmmTest(
  'PMM-15674 - Verify Cancel leaves the edit page without saving @inventory',
  async ({ api, editServicePage, page }) => {
    const service = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm');

    await editServicePage.open(service.service_id);
    await editServicePage.editEnvironment('pmm_edit_cancelled');

    const writes = editServicePage.recordApiWrites();

    await editServicePage.buttons.cancel.click();
    await expect(page).toHaveURL(new RegExp(`${editServicePage.url}$`));
    expect(writes, 'Cancel sends nothing').toEqual([]);
    expect((await api.inventoryApi.getServiceById(service.service_id)).environment ?? '').toEqual(
      service.environment ?? '',
    );
  },
);

pmmTest(
  'PMM-15674 - Verify edit page of a service that does not exist says so @inventory',
  async ({ editServicePage, page }) => {
    await page.goto(`${editServicePage.url}/${missingServiceId}/edit`);
    await expect(editServicePage.elements.notFound).toBeVisible();
    await expect(editServicePage.elements.form).toBeHidden();
  },
);

for (const role of ['Viewer', 'Editor'] as const) {
  pmmTest.describe(`Edit service access | ${role}`, () => {
    const username = `pmm_edit_${role.toLowerCase()}`;
    let userId: number;

    pmmTest.beforeEach(async ({ grafanaHelper }) => {
      ({ id: userId } = await grafanaHelper.findOrCreateUser(username, formUserPassword));

      // Grafana gives a new user the Viewer role.
      if (role === 'Editor') await grafanaHelper.promoteToEditor(userId);
    });

    pmmTest.afterEach(async ({ grafanaHelper }) => {
      await grafanaHelper.deleteUser(userId);
    });

    pmmTest(
      `PMM-15674 - Verify ${role} cannot edit a service @inventory`,
      async ({ api, editServicePage, grafanaHelper, page }) => {
        const service = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm');

        await grafanaHelper.signInAs(username, formUserPassword);
        await page.goto(`${editServicePage.url}/${service.service_id}/edit`);
        await expect(editServicePage.elements.unauthorized).toHaveText('Insufficient access permissions.');
        await expect(editServicePage.elements.form).toBeHidden();

        const response = await page.request.put(`v1/management/services/${service.service_id}`, {
          data: { [service.service_type]: { environment: 'pmm_edit_unauthorized' } },
          headers: GrafanaHelper.getAuthHeader(username, formUserPassword),
        });

        expect([401, 403], `the update API refuses a ${role}`).toContain(response.status());
      },
    );
  });
}

for (const { field, label, message, serviceRegex, value } of validationCases) {
  pmmTest(`PMM-15674 - Verify the form refuses a ${label} @inventory`, async ({ api, editServicePage }) => {
    const service = await api.inventoryApi.getServiceDetailsByRegex(serviceRegex);

    await editServicePage.open(service.service_id);
    await editServicePage.inputs[field].fill(value);

    const writes = editServicePage.recordApiWrites();

    await editServicePage.buttons.saveChanges.click();
    await expect(editServicePage.builders.fieldError(message)).toBeVisible();
    await expect(editServicePage.elements.confirmModal).toBeHidden();
    expect(writes, 'an invalid form sends nothing').toEqual([]);
  });
}

pmmTest.describe('Edit service requests | ps', () => {
  let service: GetService;
  let originalLogLevel: string;

  pmmTest.beforeEach(async ({ api }) => {
    service = await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm');
    originalLogLevel =
      (await api.inventoryApi.getServiceExporter(service.service_id, 'mysqld_exporter')).log_level ||
      'LOG_LEVEL_UNSPECIFIED';
  });

  pmmTest.afterEach(async ({ api }) => {
    await api.inventoryApi.updateService(service.service_id, service.service_type, {
      environment: service.environment ?? '',
      log_level: originalLogLevel,
    });
  });

  pmmTest(
    "PMM-15674 - Verify a refused save shows the server's reason @inventory",
    async ({ api, editServicePage, page }) => {
      const { username } = await api.inventoryApi.getServiceExporter(service.service_id, 'mysqld_exporter');

      await editServicePage.open(service.service_id);
      await editServicePage.editConnection({ password: 'wrong-password', username });

      const response = await editServicePage.saveChanges(service.service_id, false, true);

      expect(response.status(), 'the connection check refuses a wrong password').not.toEqual(200);

      const { message } = (await response.json()) as { message: string };

      await expect(editServicePage.builders.text(toNotificationText(message))).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${service.service_id}/edit$`));
    },
  );

  // ps is monitored with a stored password, so a save that resent it would show here.
  for (const { body, edit, label, settingsChanged } of [
    {
      body: { environment: 'pmm_edit_request_check' },
      edit: { environment: 'pmm_edit_request_check' },
      label: 'label',
      settingsChanged: false,
    },
    {
      body: { log_level: 'LOG_LEVEL_DEBUG' },
      edit: { logLevel: 'LOG_LEVEL_DEBUG' as const },
      label: 'setting',
      settingsChanged: true,
    },
  ]) {
    pmmTest(
      `PMM-15674 - Verify a ${label} change sends only that change, in one update call @inventory`,
      async ({ editServicePage }) => {
        await editServicePage.open(service.service_id);
        await (edit.environment
          ? editServicePage.editEnvironment(edit.environment)
          : editServicePage.editMetrics({ logLevel: edit.logLevel }));

        const writes = editServicePage.recordApiWrites();
        const response = await editServicePage.saveChanges(service.service_id, false, settingsChanged);

        expect(response.status(), await response.text()).toEqual(200);
        expect(response.request().postDataJSON(), 'untouched secrets stay out of the request').toEqual({
          [service.service_type]: body,
        });
        expect(writes, 'the save is one call to the update API').toEqual([
          `PUT /v1/management/services/${service.service_id}`,
        ]);
      },
    );
  }
});
