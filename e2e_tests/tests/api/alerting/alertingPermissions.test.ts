import { APIResponse, expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';

// Set by the test, deleted by the afterEach hook so cleanup runs even on failure.
let viewerId: number | undefined;
let editorId: number | undefined;

pmmTest.afterEach(async ({ request }) => {
  const admin = GrafanaHelper.getAuthHeader();

  if (viewerId) await request.delete(`graph/api/admin/users/${viewerId}`, { headers: admin });
  if (editorId) await request.delete(`graph/api/admin/users/${editorId}`, { headers: admin });
});

// PMM-15138: a Viewer may list alert templates but must not create, update or delete
// templates, nor create rules. An Editor must be allowed to manage them. The auth layer
// denies a forbidden write with HTTP 403 / code 7 (PermissionDenied) before the request
// reaches the backend, so the request body is irrelevant for the Viewer assertions.
pmmTest(
  'PMM-15138 - Viewer cannot create/update/delete alert templates or rules; Editor can @alerting-api',
  async ({ request }) => {
    const suffix = Date.now();
    const viewer = { login: `viewer-${suffix}`, password: 'Viewer-pw-12345' };
    const editor = { login: `editor-${suffix}`, password: 'Editor-pw-12345' };
    const admin = GrafanaHelper.getAuthHeader();

    // Created users default to the Viewer org role; the editor is promoted below.
    const createUser = async ({ login, password }: { login: string; password: string }) => {
      const res = await request.post('graph/api/admin/users', {
        data: { login, name: login, OrgId: 1, password },
        headers: admin,
      });

      expect(res.status(), `create user ${login}`).toBe(200);

      return (await res.json()).id as number;
    };

    const templateName = `pmm15138_${suffix}`;
    const templatePath = `${apiEndpoints.alerting.templates}/${templateName}`;
    // Deliberately invalid: the Viewer is rejected by auth first, the Editor by the backend.
    const yamlBody = { yaml: 'placeholder' };

    // Every write the ticket forbids for a Viewer, parameterised by the caller's auth header.
    const writes = (headers: Record<string, string>): { label: string; send: () => Promise<APIResponse> }[] => [
      {
        label: 'POST templates',
        send: () => request.post(apiEndpoints.alerting.templates, { data: yamlBody, headers }),
      },
      {
        label: 'PUT template',
        send: () => request.put(templatePath, { data: { name: templateName, ...yamlBody }, headers }),
      },
      {
        label: 'DELETE template',
        send: () => request.delete(templatePath, { headers }),
      },
      {
        label: 'POST rule',
        send: () => request.post(apiEndpoints.alerting.rules, { data: { template_name: templateName }, headers }),
      },
    ];

    viewerId = await createUser(viewer);
    editorId = await createUser(editor);

    const roleRes = await request.patch(`graph/api/org/users/${editorId}`, {
      data: { role: 'Editor' },
      headers: admin,
    });

    expect(roleRes.status(), 'promote editor').toBe(200);

    const asViewer = GrafanaHelper.getAuthHeader(viewer.login, viewer.password);
    const asEditor = GrafanaHelper.getAuthHeader(editor.login, editor.password);

    await pmmTest.step('Viewer can list alert templates', async () => {
      const res = await request.get(apiEndpoints.alerting.templates, { headers: asViewer });

      expect(res.status()).toBe(200);
    });

    await pmmTest.step('Viewer is denied every alerting write with 403', async () => {
      for (const { label, send } of writes(asViewer)) {
        const res = await send();

        expect(res.status(), `viewer ${label}`).toBe(403);
        // 7 == codes.PermissionDenied
        expect((await res.json()).code, `viewer ${label} code`).toBe(7);
      }
    });

    await pmmTest.step('Editor is authorized for every alerting write (not 403)', async () => {
      for (const { label, send } of writes(asEditor)) {
        const res = await send();

        expect(res.status(), `editor ${label}`).not.toBe(403);
      }
    });
  },
);
