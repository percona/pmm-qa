import { Locator, Response } from '@playwright/test';
import BasePage, { NestedLocatorMap, NestedLocatorNode, NestedLocators } from './base.page';
import pmmTest from '@fixtures/pmmTest';

export default class LeftNavigation extends BasePage {
  builders: Record<string, (...args: string[]) => Locator> = {};
  buttons: NestedLocatorMap = {
    accounts: {
      elements: {
        changePassword: this.page.getByTestId('navitem-password-change'),
        changeTheme: this.page.getByTestId('navitem-theme-toggle'),
        notificationHistory: this.page.getByTestId('navitem-notification-history'),
        profile: this.page.getByTestId('navitem-profile'),
        signOut: this.page.getByTestId('navitem-sign-out'),
      },
      locator: this.page.getByTestId('navitem-account'),
    },
    alerts: {
      elements: {
        alertGroups: this.page.getByTestId('navitem-alerts-groups'),
        alertRules: this.page.getByTestId('navitem-alerts-rules'),
        alertSettings: this.page.getByTestId('navitem-alerts-settings'),
        contactPoints: this.page.getByTestId('navitem-alerts-contact-points'),
        firedAlerts: this.page.getByTestId('navitem-alerts-fired'),
        notificationPolicies: this.page.getByTestId('navitem-alerts-policies'),
        perconaAlertTemplates: this.page.getByTestId('navitem-alerts-templates'),
        silences: this.page.getByTestId('navitem-alerts-silences'),
      },
      locator: this.page.getByTestId('navitem-alerts'),
    },
    alldashboards: {
      elements: {
        browseall: this.page.getByTestId('navitem-dashboards-browse'),
        libraryPanels: this.page.getByTestId('navitem-dashboards-library-panels'),
        playlists: this.page.getByTestId('navitem-dashboards-playlists'),
        shared: this.page.getByTestId('navitem-dashboards-shared'),
        snapshots: this.page.getByTestId('navitem-dashboards-snapshots'),
      },
      locator: this.page.getByTestId('navitem-dashboards'),
    },
    backups: {
      elements: {
        allBackups: this.page.getByTestId('navitem-backup-inventory'),
        restores: this.page.getByTestId('navitem-restore-history'),
        scheduledJobs: this.page.getByTestId('navitem-scheduled-backups'),
        storageLocation: this.page.getByTestId('navitem-storage-locations'),
      },
      locator: this.page.getByTestId('navitem-backups'),
    },
    configuration: {
      elements: {
        org: {
          defaultPreferences: this.page.getByTestId('navitem-default-preferences'),
          organizations: this.page.getByTestId('navitem-organizations'),
          statsAndLicense: this.page.getByTestId('navitem-stats-and-licenses'),
        },
        orgManagement: this.page.getByTestId('navitem-org-management'),
        settings: this.page.getByTestId('navitem-configuration-settings'),
        updates: this.page.getByTestId('navitem-updates'),
      },
      locator: this.page.getByTestId('navitem-configuration'),
    },
    explore: {
      elements: {
        metrics: this.page.getByTestId('navitem-explore-metrics'),
        promSqlBuilder: this.page.getByTestId('navitem-explore-promsql-builder'),
      },
      locator: this.page.getByTestId('navitem-explore'),
    },
    help: { locator: this.page.getByTestId('navitem-help'), verifyTimeRange: true },
    home: { locator: this.page.getByTestId('navitem-home-page'), verifyTimeRange: true },
    inventory: {
      elements: {
        addServices: this.page.getByTestId('navitem-add-instance'),
        nodes: this.page.getByTestId('navitem-inventory-nodes'),
        services: this.page.getByTestId('navitem-inventory-services'),
      },
      locator: this.page.getByTestId('navitem-inventory'),
    },
    mongodb: {
      elements: {
        backupStatus: this.page.getByTestId('navitem-mongo-backup-details-list-item'),
        collections: this.page.getByTestId('navitem-mongo-collections-overview'),
        ha: {
          cluster: this.page.getByTestId('navitem-mongo-cluster-summary'),
          replSet: this.page.getByTestId('navitem-mongo-rplset-summary'),
          router: this.page.getByTestId('navitem-mongo-router-summary'),
        },
        highAvailability: this.page.getByTestId('navitem-mongo-high-availability'),
        oplog: this.page.getByTestId('navitem-mongo-oplog-details'),
        otherDashboards: this.page.getByTestId('navitem-mongo-other-dashboards'),
        overview: this.page.getByTestId('navitem-mongo-overview'),
        summary: this.page.getByTestId('navitem-mongo-summary'),
      },
      locator: this.page.getByTestId('navitem-mongo'),
    },
    mysql: {
      elements: {
        commandHandler: this.page.getByTestId('navitem-mysql-command-handler-counters-compare'),
        ha: {
          groupReplication: this.page.getByTestId('navitem-mysql-group-replication-summary'),
          pxcGaleraCluster: this.page.getByTestId('navitem-pxc-cluster-summary'),
          pxcGaleraNode: this.page.getByTestId('navitem-pxc-node-summary'),
          pxcGaleraNodes: this.page.getByTestId('navitem-pxc-nodes-compare'),
          replication: {
            locator: this.page.getByTestId('navitem-mysql-replication-summary'),
          },
        },
        highAvailability: {
          locator: this.page.getByTestId('navitem-mysql-high-availability'),
          verifyTimeRange: true,
        },
        innodbCompression: this.page.getByTestId('navitem-mysql-innodb-compression-details'),
        innodbDetails: this.page.getByTestId('navitem-mysql-innodb-details'),
        myRocks: this.page.getByTestId('navitem-mysql-myrocks-details'),
        otherDashboards: this.page.getByTestId('navitem-mysql-other-dashboards'),
        overview: this.page.getByTestId('navitem-mysql-overview'),
        performanceSchema: this.page.getByTestId('navitem-mysql-performance-schema-details'),
        summary: { locator: this.page.getByTestId('navitem-mysql-summary'), verifyTimeRange: true },
        tableDetails: this.page.getByTestId('navitem-mysql-table-details'),
      },
      locator: this.page.getByTestId('navitem-mysql'),
      verifyTimeRange: true,
    },
    operatingsystem: {
      elements: {
        cpuUtilization: this.page.getByTestId('navitem-cpu-utilization'),
        disk: this.page.getByTestId('navitem-disk'),
        memory: this.page.getByTestId('navitem-memory'),
        network: this.page.getByTestId('navitem-network'),
        numa: this.page.getByTestId('navitem-numa'),
        otherDashboards: this.page.getByTestId('navitem-system-other-dashboards'),
        overview: this.page.getByTestId('navitem-node-overview'),
        processes: this.page.getByTestId('navitem-processes'),
        summary: this.page.getByTestId('navitem-node-summary'),
        temperature: this.page.getByTestId('navitem-temperature'),
      },
      locator: this.page.getByTestId('navitem-system'),
      verifyTimeRange: true,
    },
    perconaadvisors: {
      elements: {
        configurtaion: this.page.getByTestId('navitem-advisors-configuration'),
        insights: this.page.getByTestId('navitem-advisors-insights'),
        performance: this.page.getByTestId('navitem-advisors-performance'),
        query: this.page.getByTestId('navitem-advisors-query'),
        security: this.page.getByTestId('navitem-advisors-security'),
      },
      locator: this.page.getByTestId('navitem-advisors'),
    },
    postgresql: {
      elements: {
        ha: {
          patroni: this.page.getByTestId('navitem-postgresql-patroni'),
          replication: this.page.getByTestId('navitem-postgresql-replication'),
        },
        highAvailability: this.page.getByTestId('navitem-postgresql-ha'),
        otherDashboards: this.page.getByTestId('navitem-postgre-other-dashboards'),
        overview: this.page.getByTestId('navitem-postgresql-overwiew'),
        summary: this.page.getByTestId('navitem-postgresql-summary'),
        topQueries: this.page.getByTestId('navitem-postgresql-top-queries'),
      },
      locator: this.page.getByTestId('navitem-postgre'),
      verifyTimeRange: true,
    },
    qan: this.page.getByTestId('navitem-qan'),
    usersAndAccess: {
      elements: {
        serviceAccounts: this.page.getByTestId('navitem-service-accounts'),
        teams: this.page.getByTestId('navitem-teams'),
        users: this.page.getByTestId('navitem-users'),
      },
      locator: this.page.getByTestId('navitem-users-and-access'),
    },
    valkey: {
      elements: {
        clients: this.page.getByTestId('navitem-valkey-clients'),
        clusterDetails: this.page.getByTestId('navitem-valkey-cluster-details'),
        commands: this.page.getByTestId('navitem-valkey-commands'),
        load: this.page.getByTestId('navitem-valkey-load'),
        memory: this.page.getByTestId('navitem-valkey-memory'),
        network: this.page.getByTestId('navitem-valkey-network'),
        otherDashboards: this.page.getByTestId('navitem-valkey-other-dashboards'),
        overview: this.page.getByTestId('navitem-valkey-overview'),
        persistence: this.page.getByTestId('navitem-valkey-persistence'),
        replication: this.page.getByTestId('navitem-valkey-replication'),
        slowlog: this.page.getByTestId('navitem-valkey-slowlog'),
        summary: this.page.getByTestId('navitem-valkey-overview'),
      },
      locator: this.page.getByTestId('navitem-valkey'),
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
  inputs: Record<string, Locator> = {};
  messages: Record<string, Locator> = {};

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

      for (let i = 0; i < parts.length; i++) {
        const openerKey =
          parts[i] === 'ha' ? 'highAvailability' : parts[i] === 'org' ? 'orgManagement' : undefined;
        if (!openerKey) continue;

        const openerPath = [...parts.slice(0, i), openerKey].join('.');

        await this.resolveLocator(openerPath)?.click();
      }

      await this.resolveLocator(path)?.click();
    });
  };

  traverseAllMenuItems = async (
    menuItem: (locator: Locator, res: Response | null) => Promise<void>,
  ): Promise<void> => {
    await this.traverseNode(this.buttons, '', menuItem);
  };

  variableContext = (text: string): Locator => this.grafanaIframe().getByText(text, { exact: true }).first();

  dashboardsToVerifyTimeRange(): string[] {
    const dashboards: string[] = [];

    for (const [key, value] of Object.entries(this.buttons)) {
      this.collectVerifyTimeRange(value, key, dashboards);
    }

    return dashboards;
  }

  private collectVerifyTimeRange(node: NestedLocators, path: string, dashboards: string[]): void {
    if (!this.isLocator(node) && (node as NestedLocatorNode).verifyTimeRange === true) {
      dashboards.push(path);
    }

    const children = this.extractChildren(node);

    if (!children) return;

    for (const [key, value] of Object.entries(children)) {
      this.collectVerifyTimeRange(value, path ? `${path}.${key}` : key, dashboards);
    }
  }

  private extractChildren(node: NestedLocators): Record<string, NestedLocators> | null {
    if (this.isLocator(node)) return null;

    const typed = node as NestedLocatorNode;

    if (typed.elements) return typed.elements;
    if (!typed.locator) {
      return Object.fromEntries(
        Object.entries(typed)
          .filter(([key]) => !['locator', 'elements', 'verifyTimeRange', 'page', 'signOut'].includes(key))
          .map(([key, value]) => [key, value as NestedLocators]),
      );
    }

    return null;
  }

  private extractLocator(node: NestedLocators): Locator | null {
    if (this.isLocator(node)) return node;

    const typed = node as NestedLocatorNode;

    if (typed.locator && this.isLocator(typed.locator)) return typed.locator;

    return null;
  }

  private handleTourPopover = async (): Promise<void> => {
    if ((await this.elements.tourPopover.isVisible()) || (await this.elements.tourMask.isVisible())) {
      await this.elements.closeButton.click();
      await this.elements.tourPopover.waitFor({ state: 'hidden' });
    }
  };

  private isIgnoredUrl(url: string): boolean {
    return url.includes('/settings') || url.includes('/admin_config');
  }

  private isLocator(value: NestedLocators): value is Locator {
    return typeof (value as Locator).click === 'function';
  }

  private resolveLocator(path: string): Locator | null {
    const keys = path.split('.');
    let node: NestedLocators | undefined = this.buttons[keys[0]];

    for (let i = 1; i < keys.length; i++) {
      if (!node || this.isLocator(node)) return null;

      const typed = node as NestedLocatorNode;
      const key = keys[i];

      node = (typed.elements?.[key] ?? typed[key]) as NestedLocators | undefined;
    }

    return node ? this.extractLocator(node) : null;
  }

  private traverseNode = async (
    node: NestedLocators,
    path: string,
    menuItem: (locator: Locator, res: Response | null) => Promise<void>,
  ): Promise<void> => {
    const locator = this.extractLocator(node);

    if (locator) {
      const responsePromise = this.page
        .waitForResponse((res: Response) => !this.isIgnoredUrl(res.url()), { timeout: 10_000 })
        .catch(() => null);

      await locator.click();

      if (path.includes('alerts')) await this.handleTourPopover();

      await menuItem(locator, await responsePromise);
    }

    const children = this.extractChildren(node);

    if (!children) return;

    for (const [key, value] of Object.entries(children)) {
      if (['locator', 'elements', 'verifyTimeRange', 'page', 'signOut'].includes(key)) continue;

      const openMenu = key === 'ha' ? 'highAvailability' : key === 'org' ? 'orgManagement' : undefined;

      if (openMenu && children[openMenu]) {
        await this.extractLocator(children[openMenu])?.click();
      }

      await this.traverseNode(value, path ? `${path}.${key}` : key, menuItem);
    }
  };
}
