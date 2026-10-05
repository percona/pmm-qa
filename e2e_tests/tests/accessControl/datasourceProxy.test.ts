import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import DatasourceProxyApi from '@api/datasourceProxy.api';
import { ProxyUserIds } from '@helpers/accessControl.helper';
import { Timeouts } from '@helpers/timeouts';
import {
  admin,
  canaryMetric,
  dataSourceRoutes,
  deleteCanary,
  exportUp,
  fullAccessRoleTitle,
  internalPaths,
  metricsDataSourceUrl,
  noAccessRole,
  queryUp,
  viewer,
} from '@testdata/datasourceProxy';
import { mysqlAllowedPanels, mysqlDisallowedPanels } from './accessControl.constants';

pmmTest.describe.configure({ mode: 'serial' });

const mysqlOverviewUrl = 'pmm-ui/graph/d/mysql-instance-overview/mysql-instances-overview?from=now-1h&to=now';
let ids: ProxyUserIds;
let routes: ReturnType<typeof dataSourceRoutes>;

pmmTest.beforeEach(async ({ accessControlHelper, grafanaHelper }) => {
  await grafanaHelper.authorize();
  ids = await accessControlHelper.setupUsers();

  const { id, uid } = await accessControlHelper.getMetricsDataSource();

  routes = dataSourceRoutes(id, uid);
});

pmmTest.afterEach(async ({ accessControlHelper }) => {
  await accessControlHelper.setAccessControl(true);
  await accessControlHelper.assignRole(ids.viewer, fullAccessRoleTitle);
});

pmmTest(
  'PMM-T2345 - Verify a Viewer with no access to any service gets no metrics through any address of the Metrics data source @LBAC',
  async ({ accessControlHelper, api, dashboard, grafanaHelper, page }) => {
    const proxyApi = api.datasourceProxyApi;
    const copy = await proxyApi.createDataSource(`Metrics copy ${Date.now()}`, metricsDataSourceUrl);
    const copyRoute = `/graph/api/datasources/proxy/${copy.id}/`;

    try {
      await accessControlHelper.assignRole(ids.viewer, noAccessRole.title);

      await pmmTest.step('Admin gets every series by UID', async () => {
        const { body, status } = await proxyApi.get(`${routes.proxyByUid}${queryUp}`, admin);

        expect(status).toEqual(200);
        expect(DatasourceProxyApi.countResults(body)).toBeGreaterThan(0);
      });

      for (const route of [
        routes.proxyById,
        routes.proxyByUid,
        routes.resourcesById,
        routes.resourcesByUid,
        copyRoute,
      ]) {
        await pmmTest.step(`Viewer gets no series through ${route}`, async () => {
          const { body, status } = await proxyApi.get(`${route}${queryUp}`, viewer);

          expect(status, body).toEqual(200);
          expect(DatasourceProxyApi.countResults(body), body).toEqual(0);
        });
      }

      for (const route of [routes.proxyById, routes.proxyByUid, copyRoute]) {
        await pmmTest.step(`Viewer exports nothing through ${route}`, async () => {
          const { body, status } = await proxyApi.get(`${route}${exportUp}`, viewer);

          expect(status).toEqual(200);
          expect(body.trim()).toEqual('');
        });
      }

      await pmmTest.step('Viewer sees no data on the MySQL dashboard', async () => {
        await grafanaHelper.signInAs(viewer.username, viewer.password);
        await page.goto(mysqlOverviewUrl);
        await dashboard.verifyPanelsShowNoRealDataMarkers(mysqlDisallowedPanels);
      });
    } finally {
      await api.grafanaApi.deleteDataSource(copy.uid);
    }
  },
);

pmmTest(
  'PMM-T2346 - Verify a Viewer with full access still gets every metric through each address of the Metrics data source @LBAC',
  async ({ accessControlHelper, api, dashboard, grafanaHelper, page }) => {
    const proxyApi = api.datasourceProxyApi;

    const expectSameAsAdmin = async (routeList: string[]) => {
      for (const route of routeList) {
        await expect(async () => {
          const adminCount = DatasourceProxyApi.countResults(
            (await proxyApi.get(`${routes.proxyByUid}${queryUp}`, admin)).body,
          );
          const { body, status } = await proxyApi.get(`${route}${queryUp}`, viewer);

          expect(status).toEqual(200);
          expect(adminCount).toBeGreaterThan(0);
          expect(DatasourceProxyApi.countResults(body), route).toEqual(adminCount);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.ONE_MINUTE });
      }
    };

    await pmmTest.step('With access control on, Viewer gets what Admin gets', async () => {
      await expectSameAsAdmin([
        routes.proxyById,
        routes.proxyByUid,
        routes.resourcesByUid,
        routes.resourcesById,
      ]);
    });

    await pmmTest.step('Viewer sees data on the MySQL dashboard', async () => {
      await grafanaHelper.signInAs(viewer.username, viewer.password);
      await page.goto(mysqlOverviewUrl);
      await dashboard.verifyPanelValues(mysqlAllowedPanels);
    });

    await pmmTest.step('With access control off, Viewer gets what Admin gets', async () => {
      await accessControlHelper.setAccessControl(false);
      await expectSameAsAdmin([routes.proxyByUid, routes.proxyById]);
    });
  },
);

pmmTest(
  'PMM-T2347 - Verify a Viewer cannot create metric snapshots or read server internals through the Metrics data source @LBAC',
  async ({ accessControlHelper, api }) => {
    const proxyApi = api.datasourceProxyApi;
    const snapshotsBefore = accessControlHelper.countSnapshots();
    const refusalsBefore = accessControlHelper.countRefusals();

    const expectRefused = async () => {
      for (const route of [routes.proxyById, routes.resourcesByUid]) {
        for (const path of ['snapshot/create', ...internalPaths]) {
          const { status } = await proxyApi.get(`${route}${path}`, viewer);

          expect(status, `${route}${path}`).toEqual(403);
        }
      }

      for (const path of ['snapshot/create', 'metrics']) {
        const { status } = await proxyApi.get(`${routes.proxyById}${path}`, viewer, { 'X-Proxy-Admin': '1' });

        expect(status, `${path} with a forged admin header`).toEqual(403);
      }

      expect(accessControlHelper.countSnapshots()).toEqual(snapshotsBefore);
    };

    await pmmTest.step('Access control off: every request is refused', async () => {
      await accessControlHelper.setAccessControl(false);
      await expectRefused();
    });

    await pmmTest.step('Each refusal is logged', async () => {
      expect(accessControlHelper.countRefusals()).toBeGreaterThan(refusalsBefore);
    });

    await pmmTest.step('Access control on: every request is refused', async () => {
      await accessControlHelper.setAccessControl(true);
      await expectRefused();
    });
  },
);

pmmTest(
  'PMM-T2348 - Verify a Viewer cannot delete metrics through the Metrics data source @LBAC',
  async ({ accessControlHelper, api }) => {
    const proxyApi = api.datasourceProxyApi;
    const canaryQuery = `api/v1/query?query=${encodeURIComponent(`last_over_time(${canaryMetric}[1h])`)}`;
    const canaryCount = async () =>
      DatasourceProxyApi.countResults((await proxyApi.get(`${routes.proxyByUid}${canaryQuery}`, admin)).body);

    const expectDeleteRefused = async () => {
      expect((await proxyApi.post(`${routes.resourcesByUid}${deleteCanary}`, viewer)).status).toEqual(403);
      expect((await proxyApi.post(`${routes.proxyById}${deleteCanary}`, viewer)).status).toEqual(403);
      expect((await proxyApi.get(`${routes.proxyById}${deleteCanary}`, viewer)).status).toEqual(403);
      expect((await proxyApi.get(`${routes.resourcesByUid}${deleteCanary}`, viewer)).status).toEqual(403);
      expect(await canaryCount()).toEqual(1);
    };

    try {
      await pmmTest.step('Admin writes a throwaway metric', async () => {
        const { status } = await proxyApi.post(
          '/prometheus/api/v1/import/prometheus',
          admin,
          `${canaryMetric}{qa="15379"} 1\n`,
        );

        expect(status).toEqual(204);
        await expect.poll(canaryCount, { timeout: Timeouts.ONE_MINUTE }).toEqual(1);
      });

      await pmmTest.step('Access control off: Viewer cannot delete it', async () => {
        await accessControlHelper.setAccessControl(false);
        await expectDeleteRefused();
      });

      await pmmTest.step('Access control on: Viewer cannot delete it', async () => {
        await accessControlHelper.setAccessControl(true);
        await expectDeleteRefused();
      });
    } finally {
      await proxyApi.post(`/prometheus/${deleteCanary}`, admin);
    }
  },
);

pmmTest(
  'PMM-T2349 - Verify Admin can still open the VictoriaMetrics targets and cardinality pages @LBAC',
  async ({ api }) => {
    const proxyApi = api.datasourceProxyApi;

    await pmmTest.step('Admin reaches the VictoriaMetrics diagnostics', async () => {
      const targets = await proxyApi.get('/victoriametrics/targets', admin);

      expect(targets.status).toEqual(200);
      expect(targets.body).toContain('state=up');

      const tsdb = await proxyApi.get('/prometheus/api/v1/status/tsdb', admin);

      expect(tsdb.status).toEqual(200);
      expect(JSON.parse(tsdb.body).data.totalSeries).toBeGreaterThan(0);

      const apiTargets = await proxyApi.get('/prometheus/api/v1/targets', admin);

      expect(apiTargets.status).toEqual(200);
      expect(JSON.parse(apiTargets.body).data.activeTargets.length).toBeGreaterThan(0);
      expect((await proxyApi.get('/prometheus/targets', admin)).status).toEqual(200);
    });

    await pmmTest.step('Viewer is refused the admin routes', async () => {
      for (const path of [
        '/victoriametrics/targets',
        '/prometheus/api/v1/status/tsdb',
        '/prometheus/targets',
      ]) {
        expect((await proxyApi.get(path, viewer)).status, path).toEqual(403);
      }
    });

    await pmmTest.step('Cardinality stays reachable through the data source', async () => {
      const { body, status } = await proxyApi.get(`${routes.proxyById}api/v1/status/tsdb`, viewer);

      expect(status).toEqual(200);
      expect(JSON.parse(body).data.totalSeries).toBeGreaterThan(0);
    });

    await pmmTest.step('Scrape targets are refused through the data source, Admin included', async () => {
      expect((await proxyApi.get(`${routes.proxyById}api/v1/targets`, admin)).status).toEqual(403);
    });
  },
);

pmmTest(
  'PMM-T2353 - Verify a disguised address cannot get round the Metrics data source checks @LBAC',
  async ({ accessControlHelper, api }) => {
    const proxyApi = api.datasourceProxyApi;
    const traversal = '/..'.repeat(6);
    const id = routes.proxyById.split('/').at(-2);

    await accessControlHelper.assignRole(ids.viewer, noAccessRole.title);

    for (const path of [
      `${routes.proxyById}api/v1/query${traversal}/api/v1/query?query=up`,
      `${routes.proxyById}api/v1/query${traversal.replaceAll('..', '%2E%2E')}/api/v1/query?query=up`,
      `${routes.proxyById}api/v1/query%23a=${traversal}/api/v1/query?query=up`,
      `${routes.proxyById}api/v1/query%3Fa=${traversal}/api/v1/query?query=up`,
    ]) {
      await pmmTest.step(`Refused: ${path}`, async () => {
        expect(proxyApi.getRaw(path, viewer).status).toEqual(403);
      });
    }

    await pmmTest.step('Server internals behind an encoded # are refused', async () => {
      const { body, status } = proxyApi.getRaw(`${routes.proxyById}metrics%23/../api/v1/query`, viewer);

      expect(status).toEqual(403);
      expect(body).not.toContain('vm_promscrape');
    });

    for (const path of [
      `/graph/api/datasources%2Fproxy/${id}/${queryUp}`,
      `${routes.proxyById}${queryUp}&x=${traversal}/ping`,
    ]) {
      await pmmTest.step(`Filtered: ${path}`, async () => {
        const { body, status } = proxyApi.getRaw(path, viewer);

        expect(status).toEqual(200);
        expect(DatasourceProxyApi.countResults(body)).toEqual(0);
      });
    }

    await pmmTest.step('An anonymous caller is asked to log in', async () => {
      expect(proxyApi.getRaw('/prometheus/api/v1/query?query=up&x=/../../../../ping').status).toEqual(401);
    });
  },
);
