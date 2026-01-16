import { Locator, Page } from "@playwright/test";
import basePage from "./base.page";

export type MenuItem = Locator | (() => Locator) | { [key: string]: MenuItem };

export interface MenuItemPath {
  path: string;
}

export default class LeftNavigation extends basePage {
  public readonly simpleMenuItems = ['home', 'qan', 'help'] as const;
  public readonly menuWithChildren = [
    'mysql',
    'postgresql',
    'mongodb',
    'operatingsystem',
    'alldashboards',
    'explore',
    'alerts',
    'perconaadvisors',
    'inventory',
    'backups',
    'configuration',
    'usersAndAccess',
    'accounts'
  ] as const;
  public readonly dashboardsToVerifyTimeRange = [
    'mysql',
    'mysqlMenu.summary',
    'mysqlMenu.highAvailability',
    'mysqlMenu.ha.replication',
    'postgresql',
    'operatingsystem',
    // 'qan', // TODO: remove comment after the QAN is fixed
    'help',
    'home'
  ] as const;

  constructor(page: Page) { super(page); }
  public elements = {
    // parent menu items
    home: () => this.page.getByTestId('navitem-home-page'),
    mysql: () => this.page.getByTestId('navitem-mysql'),
    postgresql: () => this.page.getByTestId('navitem-postgre'),
    mongodb: () => this.page.getByTestId('navitem-mongo'),
    operatingsystem: () => this.page.getByTestId('navitem-system'),
    alldashboards: () => this.page.getByTestId('navitem-dashboards'),
    qan: () => this.page.getByTestId('navitem-qan'),
    explore: () => this.page.getByTestId('navitem-explore'),
    alerts: () => this.page.getByTestId('navitem-alerts'),
    perconaadvisors: () => this.page.getByTestId('navitem-advisors'),
    inventory: () => this.page.getByTestId('navitem-inventory'),
    backups: () => this.page.getByTestId('navitem-backups'),
    configuration: () => this.page.getByTestId('navitem-configuration'),
    usersAndAccess: () => this.page.getByTestId('navitem-users-and-access'),
    accounts: () => this.page.getByTestId('navitem-account'),
    help: () => this.page.getByTestId('navitem-help'),
    // child menu items
    mysqlMenu: {
      overview: () => this.page.getByTestId('navitem-mysql-overview'),
      summary: () => this.page.getByTestId('navitem-mysql-summary'),
      highAvailability: () => this.page.getByTestId('navitem-mysql-high-availability'),
      ha: {
        groupReplication: () => this.page.getByTestId('navitem-mysql-group-replication-summary'),
        replication: () => this.page.getByTestId('navitem-mysql-replication-summary'),
        pxcGaleraCluster: () => this.page.getByTestId('navitem-pxc-cluster-summary'),
        pxcGaleraNode: () => this.page.getByTestId('navitem-pxc-node-summary'),
        pxcGaleraNodes: () => this.page.getByTestId('navitem-pxc-nodes-compare'),
      },
      commandHandler: () => this.page.getByTestId('navitem-mysql-command-handler-counters-compare'),
      innodbDetails: () => this.page.getByTestId('navitem-mysql-innodb-details'),
      innodbCompression: () => this.page.getByTestId('navitem-mysql-innodb-compression-details'),
      performanceSchema: () => this.page.getByTestId('navitem-mysql-performance-schema-details'),
      queryResponseTime: () => this.page.getByTestId('navitem-mysql-query-response-time-details'),
      tableDetails: () => this.page.getByTestId('navitem-mysql-table-details'),
      tokudbDetails: () => this.page.getByTestId('navitem-mysql-tokudb-details'),
      otherDashboards: () => this.page.getByTestId('navitem-mysql-other-dashboards'),
    },
    postgresqlMenu: {
      overview: () => this.page.getByTestId('navitem-postgresql-overwiew'),
      summary: () => this.page.getByTestId('navitem-postgresql-summary'),
      highAvailability: () => this.page.getByTestId('navitem-postgresql-ha'),
      ha: {
        replication: () => this.page.getByTestId('navitem-postgresql-replication'),
        patroni: () => this.page.getByTestId('navitem-postgresql-patroni'),
      },
      topQueries: () => this.page.getByTestId('navitem-postgresql-top-queries'),
      otherDashboards: () => this.page.getByTestId('navitem-postgre-other-dashboards'),
    },
    mongodbMenu: {
      overview: () => this.page.getByTestId('navitem-mongo-overview'),
      summary: () => this.page.getByTestId('navitem-mongo-summary'),
      highAvailability: () => this.page.getByTestId('navitem-mongo-high-availability'),
      ha: {
        cluster: () => this.page.getByTestId('navitem-mongo-cluster-summary'),
        replSet: () => this.page.getByTestId('navitem-mongo-rplset-summary'),
        router: () => this.page.getByTestId('navitem-mongo-router-summary'),
      },
      inMemory: () => this.page.getByTestId('navitem-mongo-memory-details'),
      wiredTiger: () => this.page.getByTestId('navitem-mondo-wiredtiger-details'),
      collections: () => this.page.getByTestId('navitem-mongo-collections-overview'),
      oplog: () => this.page.getByTestId('navitem-mongo-oplog-details'),
      otherDashboards: () => this.page.getByTestId('navitem-mongo-other-dashboards'),
    },
    operatingsystemMenu: {
      overview: () => this.page.getByTestId('navitem-node-overview'),
      summary: () => this.page.getByTestId('navitem-node-summary'),
      cpuUtilization: () => this.page.getByTestId('navitem-cpu-utilization'),
      disk: () => this.page.getByTestId('navitem-disk'),
      memory: () => this.page.getByTestId('navitem-memory'),
      network: () => this.page.getByTestId('navitem-network'),
      temperature: () => this.page.getByTestId('navitem-temperature'),
      numa: () => this.page.getByTestId('navitem-numa'),
      processes: () => this.page.getByTestId('navitem-processes'),
      otherDashboards: () => this.page.getByTestId('navitem-system-other-dashboards'),
    },
    alldashboardsMenu: {
      browseall: () => this.page.getByTestId('navitem-dashboards-browse'),
      shared: () => this.page.getByTestId('navitem-dashboards-shared'),
      playlists: () => this.page.getByTestId('navitem-dashboards-playlists'),
      snapshots: () => this.page.getByTestId('navitem-dashboards-snapshots'),
      libraryPanels: () => this.page.getByTestId('navitem-dashboards-library-panels'),
    },
    exploreMenu: {
      promSqlBuilder: () => this.page.getByTestId('navitem-explore-promsql-builder'),
      metrics: () => this.page.getByTestId('navitem-explore-metrics'),
    },
    alertsMenu: {
      firedAlerts: () => this.page.getByTestId('navitem-alerts-fired'),
      alertRules: () => this.page.getByTestId('navitem-alerts-rules'),
      contactPoints: () => this.page.getByTestId('navitem-alerts-contact-points'),
      notificationPolicies: () => this.page.getByTestId('navitem-alerts-policies'),
      silences: () => this.page.getByTestId('navitem-alerts-silences'),
      alertGroups: () => this.page.getByTestId('navitem-alerts-groups'),
      alertSettings: () => this.page.getByTestId('navitem-alerts-settings'),
      perconaAlertTemplates: () => this.page.getByTestId('navitem-alerts-templates'),
    },
    perconaadvisorsMenu: {
      insights: () => this.page.getByTestId('navitem-advisors-insights'),
      configurtaion: () => this.page.getByTestId('navitem-advisors-configuration'),
      performance: () => this.page.getByTestId('navitem-advisors-performance'),
      query: () => this.page.getByTestId('navitem-advisors-query'),
      security: () => this.page.getByTestId('navitem-advisors-security'),
    },
    inventoryMenu: {
      addServices: () => this.page.getByTestId('navitem-add-instance'),
      services: () => this.page.getByTestId('navitem-inventory-services'),
      nodes: () => this.page.getByTestId('navitem-inventory-nodes'),
    },
    backupsMenu: {
      allBackups: () => this.page.getByTestId('navitem-backup-inventory'),
      scheduledJobs: () => this.page.getByTestId('navitem-scheduled-backups'),
      restores: () => this.page.getByTestId('navitem-restore-history'),
      storageLocation: () => this.page.getByTestId('navitem-storage-locations'),
    },
    configurationMenu: {
      settings: () => this.page.getByTestId('navitem-configuration-settings'),
      updates: () => this.page.getByTestId('navitem-updates'),
      orgManagement: () => this.page.getByTestId('navitem-org-management'),
      org: {
        organizations: () => this.page.getByTestId('navitem-organizations'),
        statsAndLicense: () => this.page.getByTestId('navitem-stats-and-licenses'),
        defaultPreferences: () => this.page.getByTestId('navitem-default-preferences'),
      }
    },
    usersAndAccessMenu: {
      users: () => this.page.getByTestId('navitem-users'),
      teams: () => this.page.getByTestId('navitem-teams'),
      serviceAccounts: () => this.page.getByTestId('navitem-service-accounts'),
    },
    accountsMenu: {
      profile: () => this.page.getByTestId('navitem-profile'),
      notificationHistory: () => this.page.getByTestId('navitem-notification-history'),
      changePassword: () => this.page.getByTestId('navitem-password-change'),
      changeTheme: () => this.page.getByTestId('navitem-theme-toggle'),
      signOut: () => this.page.getByTestId('navitem-sign-out'),
    },

    // Sidebar items and other elements
    closeLeftNavigationButton: () => this.page.getByTestId('sidebar-close-button'),
    openLeftNavigationButton: () => this.page.getByTestId('sidebar-open-button'),
    sidebar: () => this.page.getByTestId('pmm-sidebar'),

    // help card dump logs
    dumpLogs: () => this.page.getByTestId('help-card-pmm-dump-logs'),

    // time picker (within iframe)
    iframe: () => this.page.locator('//*[@id="grafana-iframe"]'),
    timePickerOpenButton: () => this.grafanaIframe().getByTestId('data-testid TimePicker Open Button'),
    refreshButton: () => this.grafanaIframe().getByTestId('data-testid RefreshPicker run button'),

    // old navigation 
    oldLeftMenu: () => this.page.getByTestId('data-testid navigation mega-menu'),
  };

  selectMenuItem = async (item: MenuItemPath): Promise<void> => {
    const keys = item.path.split('.');
    let element: MenuItem = this.elements;

    for (const key of keys) {
      if (element && typeof element === 'object' && typeof element !== 'function' && !('click' in element)) {
        element = (element as { [key: string]: MenuItem })[key];
      }
    }

    if (element) {
      const locator = typeof element === 'function' ? element() : (element as Locator);
      if (typeof locator.click === 'function') {
        await locator.click();
      }
    }
  }

  selectTimeRange = async (timeRange: string): Promise<void> => {
    await this.getTimeRangeOption(timeRange).click();
  }

  private getTimeRangeOption = (timeRange: string): Locator => {
    return this.grafanaIframe().locator(`//*[contains(text(), "${timeRange}")]`);
  }

  mouseHoverOnPmmLogo = async (): Promise<void> => {
    const pmmLogo = this.elements.sidebar().locator('rect');
    const rectBox = await pmmLogo.boundingBox();
    if (rectBox) {
      await this.page.mouse.move(
        rectBox.x + rectBox.width / 2,
        rectBox.y + rectBox.height / 2
      );
    }
  }

  private selectVariableValue = async (dashboardIndex: number, regex: RegExp): Promise<string> => {
    const frame = this.grafanaIframe();
    await frame.getByText('All').nth(dashboardIndex).click();
    await frame.locator('input[role="combobox"]').first().waitFor({ state: 'visible' });
    const option = frame.getByText(regex).first();
    const selectedValue = (await option.textContent())?.trim() ?? '';
    await option.click();
    await frame.locator('input[role="combobox"]').first().press('Escape');
    return selectedValue;
  }

  selectService = async (dashboardIndex: number, serviceRegex: RegExp): Promise<string> => {
    return this.selectVariableValue(dashboardIndex, serviceRegex);
  }

  selectNode = async (dashboardIndex: number, nodeRegex: RegExp): Promise<string> => {
    return this.selectVariableValue(dashboardIndex, nodeRegex);
  }

  traverseAllMenuItems = async (responseAfterClick: (locator: Locator, menuItems: string) => Promise<void>): Promise<void> => {
    const traverseMenuItems = async (child: Record<string, MenuItem>, parent: string) => {
      const items = Object.entries(child);

      for (const [key, value] of items) {
        if (key === 'signOut') {
          if (typeof value === 'function') {
            await responseAfterClick(value(), `${parent}.${key}`);
          }
          return;
        }

        if (typeof value === 'function') {
          const locator = value();
          await responseAfterClick(locator, `${parent}.${key}`);
        } else if (typeof value === 'object' && value !== null) {
          if ('click' in value && typeof (value as Record<string, unknown>).click === 'function') {
            await responseAfterClick(value as Locator, `${parent}.${key}`);
          } else {
            await traverseMenuItems(value as Record<string, MenuItem>, `${parent}.${key}`);
          }
        }
      }
    };

    for (const item of this.simpleMenuItems) {
      const element = this.elements[item];
      if (typeof element === 'function') {
        await responseAfterClick(element(), item);
      }
    }

    for (const parent of this.menuWithChildren) {
      const parentElement = this.elements[parent];
      if (typeof parentElement === 'function') {
        await responseAfterClick(parentElement(), parent);
      }

      const children = this.elements[`${parent}Menu`];
      if (children) {
        await traverseMenuItems(children as Record<string, MenuItem>, parent);
      }
    }
  }
};