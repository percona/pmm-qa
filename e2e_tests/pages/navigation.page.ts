import { Locator } from '@playwright/test';
import BasePage, { NestedLocatorMap, NestedLocator, NestedLocators } from './base.page';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

export default class LeftNavigation extends BasePage {
  builders = {};
  buttons: NestedLocatorMap = {
    accounts: {
      changePassword: { locator: this.page.getByTestId('navitem-password-change') },
      changeTheme: { locator: this.page.getByTestId('navitem-theme-toggle') },
      locator: this.page.getByTestId('navitem-account'),
      notificationHistory: { locator: this.page.getByTestId('navitem-notification-history') },
      profile: { locator: this.page.getByTestId('navitem-profile') },
      signOut: { locator: this.page.getByTestId('navitem-sign-out') },
    },
    alerts: {
      alertGroups: { locator: this.page.getByTestId('navitem-alerts-groups') },
      alertRules: { locator: this.page.getByTestId('navitem-alerts-rules') },
      alertSettings: { locator: this.page.getByTestId('navitem-alerts-settings') },
      contactPoints: { locator: this.page.getByTestId('navitem-alerts-contact-points') },
      firedAlerts: { locator: this.page.getByTestId('navitem-alerts-fired') },
      locator: this.page.getByTestId('navitem-alerts'),
      notificationPolicies: { locator: this.page.getByTestId('navitem-alerts-policies') },
      perconaAlertTemplates: { locator: this.page.getByTestId('navitem-alerts-templates') },
      silences: { locator: this.page.getByTestId('navitem-alerts-silences') },
    },
    alldashboards: {
      browseall: { locator: this.page.getByTestId('navitem-dashboards-browse') },
      libraryPanels: { locator: this.page.getByTestId('navitem-dashboards-library-panels') },
      locator: this.page.getByTestId('navitem-dashboards'),
      playlists: { locator: this.page.getByTestId('navitem-dashboards-playlists') },
      shared: { locator: this.page.getByTestId('navitem-dashboards-shared') },
      snapshots: { locator: this.page.getByTestId('navitem-dashboards-snapshots') },
    },
    backups: {
      allBackups: { locator: this.page.getByTestId('navitem-backup-inventory') },
      locator: this.page.getByTestId('navitem-backups'),
      restores: { locator: this.page.getByTestId('navitem-restore-history') },
      scheduledJobs: { locator: this.page.getByTestId('navitem-scheduled-backups') },
      storageLocation: { locator: this.page.getByTestId('navitem-storage-locations') },
    },
    configuration: {
      locator: this.page.getByTestId('navitem-configuration'),
      org: {
        defaultPreferences: { locator: this.page.getByTestId('navitem-default-preferences') },
        organizations: { locator: this.page.getByTestId('navitem-organizations') },
        statsAndLicense: { locator: this.page.getByTestId('navitem-stats-and-licenses') },
      },
      orgManagement: { locator: this.page.getByTestId('navitem-org-management') },
      settings: { locator: this.page.getByTestId('navitem-configuration-settings') },
      updates: { locator: this.page.getByTestId('navitem-updates') },
    },
    explore: {
      locator: this.page.getByTestId('navitem-explore'),
      metrics: { locator: this.page.getByTestId('navitem-explore-metrics') },
      promSqlBuilder: { locator: this.page.getByTestId('navitem-explore-promql-builder') },
    },
    help: { locator: this.page.getByTestId('navitem-help'), verifyTimeRange: true },
    home: { locator: this.page.getByTestId('navitem-home-page'), verifyTimeRange: true },
    inventory: {
      addServices: { locator: this.page.getByTestId('navitem-add-instance') },
      locator: this.page.getByTestId('navitem-inventory'),
      nodes: { locator: this.page.getByTestId('navitem-inventory-nodes') },
      services: { locator: this.page.getByTestId('navitem-inventory-services') },
    },
    mongodb: {
      backupStatus: { locator: this.page.getByTestId('navitem-mongo-backup-details-list-item') },
      collections: { locator: this.page.getByTestId('navitem-mongo-collections-overview') },
      ha: {
        cluster: { locator: this.page.getByTestId('navitem-mongo-cluster-summary') },
        replSet: { locator: this.page.getByTestId('navitem-mongo-rplset-summary') },
        router: { locator: this.page.getByTestId('navitem-mongo-router-summary') },
      },
      highAvailability: { locator: this.page.getByTestId('navitem-mongo-high-availability') },
      locator: this.page.getByTestId('navitem-mongo'),
      oplog: { locator: this.page.getByTestId('navitem-mongo-oplog-details') },
      otherDashboards: { locator: this.page.getByTestId('navitem-mongo-other-dashboards') },
      overview: { locator: this.page.getByTestId('navitem-mongo-overview') },
      summary: { locator: this.page.getByTestId('navitem-mongo-summary') },
    },
    mysql: {
      commandHandler: { locator: this.page.getByTestId('navitem-mysql-command-handler-counters-compare') },
      ha: {
        groupReplication: { locator: this.page.getByTestId('navitem-mysql-group-replication-summary') },
        pxcGaleraCluster: { locator: this.page.getByTestId('navitem-pxc-cluster-summary') },
        pxcGaleraNode: { locator: this.page.getByTestId('navitem-pxc-node-summary') },
        pxcGaleraNodes: { locator: this.page.getByTestId('navitem-pxc-nodes-compare') },
        replication: { locator: this.page.getByTestId('navitem-mysql-replication-summary') },
      },
      highAvailability: {
        locator: this.page.getByTestId('navitem-mysql-high-availability'),
        verifyTimeRange: true,
      },
      innodbCompression: { locator: this.page.getByTestId('navitem-mysql-innodb-compression-details') },
      innodbDetails: { locator: this.page.getByTestId('navitem-mysql-innodb-details') },
      locator: this.page.getByTestId('navitem-mysql'),
      myRocks: { locator: this.page.getByTestId('navitem-mysql-myrocks-details') },
      otherDashboards: { locator: this.page.getByTestId('navitem-mysql-other-dashboards') },
      overview: { locator: this.page.getByTestId('navitem-mysql-overview') },
      performanceSchema: { locator: this.page.getByTestId('navitem-mysql-performance-schema-details') },
      summary: { locator: this.page.getByTestId('navitem-mysql-summary') },
      tableDetails: { locator: this.page.getByTestId('navitem-mysql-table-details') },
      verifyTimeRange: true,
    },
    operatingsystem: {
      cpuUtilization: { locator: this.page.getByTestId('navitem-cpu-utilization') },
      disk: { locator: this.page.getByTestId('navitem-disk') },
      locator: this.page.getByTestId('navitem-system'),
      memory: { locator: this.page.getByTestId('navitem-memory') },
      network: { locator: this.page.getByTestId('navitem-network') },
      numa: { locator: this.page.getByTestId('navitem-numa') },
      otherDashboards: { locator: this.page.getByTestId('navitem-system-other-dashboards') },
      overview: { locator: this.page.getByTestId('navitem-node-overview') },
      processes: { locator: this.page.getByTestId('navitem-processes') },
      summary: { locator: this.page.getByTestId('navitem-node-summary') },
      temperature: { locator: this.page.getByTestId('navitem-temperature') },
      verifyTimeRange: true,
    },
    perconaadvisors: {
      configuration: { locator: this.page.getByTestId('navitem-advisors-configuration') },
      insights: { locator: this.page.getByTestId('navitem-advisors-insights') },
      locator: this.page.getByTestId('navitem-advisors'),
      performance: { locator: this.page.getByTestId('navitem-advisors-performance') },
      query: { locator: this.page.getByTestId('navitem-advisors-query') },
      security: { locator: this.page.getByTestId('navitem-advisors-security') },
    },
    postgresql: {
      ha: {
        patroni: { locator: this.page.getByTestId('navitem-postgresql-patroni') },
        replication: { locator: this.page.getByTestId('navitem-postgresql-replication') },
      },
      highAvailability: { locator: this.page.getByTestId('navitem-postgresql-ha') },
      locator: this.page.getByTestId('navitem-postgre'),
      otherDashboards: { locator: this.page.getByTestId('navitem-postgre-other-dashboards') },
      overview: { locator: this.page.getByTestId('navitem-postgresql-overwiew') },
      summary: { locator: this.page.getByTestId('navitem-postgresql-summary') },
      topQueries: { locator: this.page.getByTestId('navitem-postgresql-top-queries') },
      verifyTimeRange: true,
    },
    qan: this.page.getByTestId('navitem-qan'),
    usersAndAccess: {
      locator: this.page.getByTestId('navitem-users-and-access'),
      serviceAccounts: { locator: this.page.getByTestId('navitem-service-accounts') },
      teams: { locator: this.page.getByTestId('navitem-teams') },
      users: { locator: this.page.getByTestId('navitem-users') },
    },
    valkey: {
      clients: { locator: this.page.getByTestId('navitem-valkey-clients') },
      clusterDetails: { locator: this.page.getByTestId('navitem-valkey-cluster-details') },
      commands: { locator: this.page.getByTestId('navitem-valkey-commands') },
      load: { locator: this.page.getByTestId('navitem-valkey-load') },
      locator: this.page.getByTestId('navitem-valkey'),
      memory: { locator: this.page.getByTestId('navitem-valkey-memory') },
      network: { locator: this.page.getByTestId('navitem-valkey-network') },
      otherDashboards: { locator: this.page.getByTestId('navitem-valkey-other-dashboards') },
      overview: { locator: this.page.getByTestId('navitem-valkey-overview') },
      persistence: { locator: this.page.getByTestId('navitem-valkey-persistence') },
      replication: { locator: this.page.getByTestId('navitem-valkey-replication') },
      slowlog: { locator: this.page.getByTestId('navitem-valkey-slowlog') },
      summary: { locator: this.page.getByTestId('navitem-valkey-overview') },
    },
  };
  elements: Record<string, Locator> = {
    closeButton: this.page.getByTestId('tour-close-button'),
    closeLeftNavigationButton: this.page.getByTestId('sidebar-close-button'),
    dumpLogs: this.page.getByTestId('help-card-pmm-dump-logs'),
    iframe: this.page.locator('//*[@id="grafana-iframe"]'),
    oldLeftMenu: this.page.getByTestId('data-testid navigation mega-menu'),
    openLeftNavigationButton: this.page.getByTestId('sidebar-open-button'),
    refreshButton: this.grafanaIframe().getByTestId('data-testid RefreshPicker run button'),
    sidebar: this.page.getByTestId('pmm-sidebar'),
    timePickerOpenButton: this.grafanaIframe().getByTestId('data-testid TimePicker Open Button'),
    tourMask: this.page.locator('.reactour__mask'),
    tourPopover: this.page.locator('.reactour__popover'),
  };
  inputs = {};
  messages = {};

  mouseHoverOnPmmLogo = async (): Promise<void> => {
    await pmmTest.step('Hover on PMM Logo', async () => {
      const pmmLogo = this.elements.sidebar.locator('rect').first();
      const rectBox = await pmmLogo.boundingBox();

      if (rectBox) {
        await this.page.mouse.move(rectBox.x + rectBox.width / 2, rectBox.y + rectBox.height / 2);
      }
    });
  };

  selectMenuItem = async (path: string): Promise<void> => {
    await pmmTest.step(`Select menu item: ${path}`, async () => {
      const parts = path.split('.');
      let node = this.buttons as NestedLocators;

      for (const part of parts) {
        const item = node[part];

        if (!item) throw new Error(`Menu item not found: ${part} in path: ${path}`);
        if (part === 'ha' || part === 'org') {
          const expandKey = part === 'ha' ? 'highAvailability' : 'orgManagement';
          const expandLocator = this.getLocator(node[expandKey] as NestedLocator);

          await expandLocator?.click({ timeout: Timeouts.TEN_SECONDS });
        }

        node = item as NestedLocators;
      }

      const locator = this.getLocator(node as NestedLocator);

      if (!locator) throw new Error(`No locator found for path: ${path}`);

      await locator.click({ timeout: Timeouts.TEN_SECONDS });
    });
  };

  traverseAllMenuItems = async (navigate: () => Promise<void>): Promise<void> => {
    const paths: string[] = [];

    this.collectTraversePaths(this.buttons, '', paths);

    for (const path of paths) {
      await this.selectMenuItem(path);

      if (path.includes('alerts')) {
        await this.handleTourPopover();
      }

      await this.page.waitForLoadState('load', { timeout: Timeouts.TEN_SECONDS }).catch(Boolean);
      await navigate();
    }
  };

  variableContext = (text: string): Locator => this.grafanaIframe().getByText(text, { exact: true }).first();

  dashboardsToVerifyTimeRange(): string[] {
    const dashboards: string[] = [];

    this.collectVerifyTimeRangePaths(this.buttons, '', dashboards);

    return dashboards;
  }

  private collectTraversePaths(node: NestedLocator, path: string, paths: string[]): void {
    if (this.getLocator(node)) paths.push(path);
    if (node && typeof node === 'object' && !this.isLocator(node)) {
      for (const [key, value] of Object.entries(node as NestedLocators)) {
        if (['locator', 'verifyTimeRange', 'elements', 'signOut'].includes(key)) continue;

        this.collectTraversePaths(value as NestedLocator, path ? `${path}.${key}` : key, paths);
      }
    }
  }

  private collectVerifyTimeRangePaths(node: NestedLocator, path: string, paths: string[]): void {
    if (
      node &&
      typeof node === 'object' &&
      'verifyTimeRange' in node &&
      (node as NestedLocators).verifyTimeRange === true
    ) {
      paths.push(path);
    }
    if (node && typeof node === 'object' && !this.isLocator(node)) {
      for (const [key, value] of Object.entries(node as NestedLocators)) {
        if (['locator', 'verifyTimeRange', 'elements'].includes(key)) continue;

        this.collectVerifyTimeRangePaths(value as NestedLocator, path ? `${path}.${key}` : key, paths);
      }
    }
  }

  private getLocator(item: NestedLocator | undefined): Locator | undefined {
    if (!item) return undefined;
    if (this.isLocator(item)) return item;

    return 'locator' in item ? (item as NestedLocators).locator : undefined;
  }

  private handleTourPopover = async (): Promise<void> => {
    if ((await this.elements.tourPopover.isVisible()) || (await this.elements.tourMask.isVisible())) {
      await this.elements.closeButton.click();
      await this.elements.tourPopover.waitFor({ state: 'hidden' });
    }
  };

  private isLocator(item: NestedLocator | boolean | undefined): item is Locator {
    return !!item && typeof item === 'object' && 'click' in item && 'waitFor' in item;
  }
}
