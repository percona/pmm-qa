import { expect } from '@playwright/test';
import Api from '@api/api';
import DatasourceProxyApi from '@api/datasourceProxy.api';
import CliHelper from '@helpers/cli.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { GrafanaDatasource } from '@interfaces/grafana';
import {
  dataSourceRoutes,
  editor,
  fullAccessRoleTitle,
  noAccessRole,
  probe,
  queryUp,
  refusalLogLine,
  serverContainer,
  viewer,
} from '@testdata/datasourceProxy';

export interface ProxyUserIds {
  editor: number;
  probe: number;
  viewer: number;
}

export default class AccessControlHelper {
  constructor(
    private api: Api,
    private cliHelper: CliHelper,
    private grafanaHelper: GrafanaHelper,
  ) {}

  assignRole = async (userId: number, title: string) => {
    await this.api.accessControlApi.assignRole(userId, await this.getRoleId(title));
  };

  countRefusals = (): number =>
    Number(
      this.cliHelper
        .execSilent(`docker exec ${serverContainer} grep -c "${refusalLogLine}" /srv/logs/vmproxy.log`)
        .stdout.trim() || 0,
    );

  countSnapshots = (): number =>
    this.cliHelper
      .execSilent(`docker exec ${serverContainer} ls /srv/victoriametrics/data/snapshots/`)
      .getStdOutLines()
      .filter((line) => line.trim()).length;

  getMetricsDataSource = async (): Promise<GrafanaDatasource> =>
    (await this.api.grafanaApi.getDataSourceByName('Metrics')) as GrafanaDatasource;

  getRoleId = async (title: string): Promise<number> => {
    const role = (await this.api.accessControlApi.getRoles()).find((r) => r.title === title);

    expect(role, `Role "${title}" must exist`).toBeDefined();

    return Number(role?.role_id);
  };

  setAccessControl = async (enabled: boolean) => {
    await this.api.settingsApi.updateSettings({ enable_access_control: enabled });

    const { id, uid } = await this.getMetricsDataSource();
    const path = `${dataSourceRoutes(id, uid).proxyById}${queryUp}`;
    const probeResults = async () =>
      DatasourceProxyApi.countResults((await this.api.datasourceProxyApi.get(path, probe)).body);
    const options = { intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES };

    if (enabled) {
      await expect.poll(probeResults, options).toEqual(0);
    } else {
      await expect.poll(probeResults, options).toBeGreaterThan(0);
    }
  };

  setupUsers = async (): Promise<ProxyUserIds> => {
    await this.api.settingsApi.enableAccessControl();
    await this.api.accessControlApi.ensureRole(noAccessRole);

    const ids = {
      editor: (await this.grafanaHelper.findOrCreateUser(editor.username, editor.password)).id,
      probe: (await this.grafanaHelper.findOrCreateUser(probe.username, probe.password)).id,
      viewer: (await this.grafanaHelper.findOrCreateUser(viewer.username, viewer.password)).id,
    };

    await this.grafanaHelper.promoteToEditor(ids.editor);
    await this.assignRole(ids.probe, noAccessRole.title);
    await this.assignRole(ids.viewer, fullAccessRoleTitle);
    await this.assignRole(ids.editor, fullAccessRoleTitle);

    return ids;
  };
}
