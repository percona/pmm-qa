import { APIResponse, expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';
import type AlertingApi from '@api/alerting.api';
import type { AlertTemplateBody } from '@api/alerting.api';

const alertingWriteCases: {
  label: string;
  send: (
    alertingApi: AlertingApi,
    headers: Record<string, string>,
    templateName: string,
    yamlBody: AlertTemplateBody,
  ) => Promise<APIResponse>;
}[] = [
  {
    label: 'POST templates',
    send: (alertingApi, headers, _templateName, yamlBody) => alertingApi.createTemplate(headers, yamlBody),
  },
  {
    label: 'PUT template',
    send: (alertingApi, headers, templateName, yamlBody) =>
      alertingApi.updateTemplate(headers, templateName, yamlBody),
  },
  {
    label: 'DELETE template',
    send: (alertingApi, headers, templateName) => alertingApi.deleteTemplate(headers, templateName),
  },
  {
    label: 'POST rule',
    send: (alertingApi, headers, templateName) => alertingApi.createRule(headers, templateName),
  },
];
// Set by the test, deleted by the afterEach hook so cleanup runs even on failure.
let viewerId: number | undefined;
let editorId: number | undefined;
const suffix = Date.now();
const viewer = { login: `viewer-${suffix}`, password: 'Viewer-pw-12345' };
const editor = { login: `editor-${suffix}`, password: 'Editor-pw-12345' };

// PMM-15138: a Viewer may list alert templates but must not create, update or delete
// templates, nor create rules. An Editor must be allowed to manage them. The auth layer
// denies a forbidden write with HTTP 403 / code 7 (PermissionDenied) before the request
// reaches the backend, so the request body is irrelevant for the Viewer assertions.
pmmTest.describe('Alerting permissions API tests @alerting', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    viewerId = await grafanaHelper.createUser(viewer.login, viewer.password);
    editorId = await grafanaHelper.createUser(editor.login, editor.password);
    await grafanaHelper.promoteToEditor(editorId);
  });

  pmmTest.afterEach(async ({ grafanaHelper }) => {
    if (viewerId) await grafanaHelper.deleteUser(viewerId);
    if (editorId) await grafanaHelper.deleteUser(editorId);
  });

  pmmTest('PMM-T2236 - Viewer can list alert templates', async ({ api }) => {
    const res = await api.alertingApi.listTemplates(
      GrafanaHelper.getAuthHeader(viewer.login, viewer.password),
    );

    expect(res.status()).toBe(200);
  });

  for (const writeCase of alertingWriteCases) {
    pmmTest(`PMM-T2235 - Viewer cannot ${writeCase.label}; Editor can`, async ({ api }) => {
      const templateName = `pmm15138_${suffix}`;
      // Deliberately invalid: the Viewer is rejected by auth first, the Editor by the backend.
      const yamlBody = { yaml: 'placeholder' };
      const viewerRes = await writeCase.send(
        api.alertingApi,
        GrafanaHelper.getAuthHeader(viewer.login, viewer.password),
        templateName,
        yamlBody,
      );

      expect(viewerRes.status(), `viewer ${writeCase.label}`).toBe(403);
      // 7 == codes.PermissionDenied
      expect((await viewerRes.json()).code, `viewer ${writeCase.label} code`).toBe(7);

      const editorRes = await writeCase.send(
        api.alertingApi,
        GrafanaHelper.getAuthHeader(editor.login, editor.password),
        templateName,
        yamlBody,
      );

      expect(editorRes.status(), `editor ${writeCase.label}`).not.toBe(403);
    });
  }
});
