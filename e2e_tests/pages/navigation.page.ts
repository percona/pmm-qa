import { Locator, Page, Response } from '@playwright/test';
import basePage from './base.page';
import { IPageObject } from '@interfaces/pageObject';
import pmmTest from '@fixtures/pmmTest';

export default class LeftNavigation extends basePage implements IPageObject {
  public readonly buttons;
  public readonly elements;

  constructor(page: Page) {
    super(page);
    this.buttons = {
      home: { locator: this.page.getByTestId('navitem-home-page'), verifyTimeRange: true },
      qan: this.page.getByTestId('navitem-qan'), // TODO: add verifyTimeRange
      help: { locator: this.page.getByTestId('navitem-help'), verifyTimeRange: true },
      mysql: {
        locator: this.page.getByTestId('navitem-mysql'),
        verifyTimeRange: true,
        elements: {
          overview: this.page.getByTestId('navitem-mysql-overview'),
          summary: { locator: this.page.getByTestId('navitem-mysql-summary'), verifyTimeRange: true },
          highAvailability: {
            locator: this.page.getByTestId('navitem-mysql-high-availability'),
            verifyTimeRange: true,
          },
          ha: {
            groupReplication: this.page.getByTestId('navitem-mysql-group-replication-summary'),
            replication: {
              locator: this.page.getByTestId('navitem-mysql-replication-summary'),
              verifyTimeRange: true,
            },
            pxcGaleraCluster: this.page.getByTestId('navitem-pxc-cluster-summary'),
            pxcGaleraNode: this.page.getByTestId('navitem-pxc-node-summary'),
            pxcGaleraNodes: this.page.getByTestId('navitem-pxc-nodes-compare'),
          },
          commandHandler: this.page.getByTestId('navitem-mysql-command-handler-counters-compare'),
          innodbDetails: this.page.getByTestId('navitem-mysql-innodb-details'),
          innodbCompression: this.page.getByTestId('navitem-mysql-innodb-compression-details'),
          performanceSchema: this.page.getByTestId('navitem-mysql-performance-schema-details'),
          tableDetails: this.page.getByTestId('navitem-mysql-table-details'),
          myRocks: this.page.getByTestId('navitem-mysql-myrocks-details'),
          otherDashboards: this.page.getByTestId('navitem-mysql-other-dashboards'),
        },
      } /*
      postgresql: {
        locator: this.page.getByTestId('navitem-postgre'),
        verifyTimeRange: true,
        elements: {
          overview: this.page.getByTestId('navitem-postgresql-overwiew'),
          summary: this.page.getByTestId('navitem-postgresql-summary'),
          highAvailability: this.page.getByTestId('navitem-postgresql-ha'),
          ha: {
            replication: this.page.getByTestId('navitem-postgresql-replication'),
            patroni: this.page.getByTestId('navitem-postgresql-patroni'),
          },
          topQueries: this.page.getByTestId('navitem-postgresql-top-queries'),
          otherDashboards: this.page.getByTestId('navitem-postgre-other-dashboards'),
        },
      } 
      mongodb: {
        locator: this.page.getByTestId('navitem-mongo'),
        elements: {
          overview: this.page.getByTestId('navitem-mongo-overview'),
          summary: this.page.getByTestId('navitem-mongo-summary'),
          highAvailability: this.page.getByTestId('navitem-mongo-high-availability'),
          ha: {
            cluster: this.page.getByTestId('navitem-mongo-cluster-summary'),
            replSet: this.page.getByTestId('navitem-mongo-rplset-summary'),
            router: this.page.getByTestId('navitem-mongo-router-summary'),
          },
          backupStatus: this.page.getByTestId('navitem-mongo-backup-details-list-item'),
          collections: this.page.getByTestId('navitem-mongo-collections-overview'),
          oplog: this.page.getByTestId('navitem-mongo-oplog-details'),
          otherDashboards: this.page.getByTestId('navitem-mongo-other-dashboards'),
        },
      },
      valkey: {
        locator: this.page.getByTestId('navitem-valkey'),
        elements: {
          overview: this.page.getByTestId('navitem-valkey-overview'),
          summary: this.page.getByTestId('navitem-valkey-overview'),
          load: this.page.getByTestId('navitem-valkey-load'),
          memory: this.page.getByTestId('navitem-valkey-memory'),
          network: this.page.getByTestId('navitem-valkey-network'),
          clients: this.page.getByTestId('navitem-valkey-clients'),
          clusterDetails: this.page.getByTestId('navitem-valkey-cluster-details'),
          replication: this.page.getByTestId('navitem-valkey-replication'),
          persistence: this.page.getByTestId('navitem-valkey-persistence'),
          commands: this.page.getByTestId('navitem-valkey-commands'),
          slowlog: this.page.getByTestId('navitem-valkey-slowlog'),
          otherDashboards: this.page.getByTestId('navitem-valkey-other-dashboards'),
        },
      },
      operatingsystem: {
        locator: this.page.getByTestId('navitem-system'),
        verifyTimeRange: true,
        elements: {
          overview: this.page.getByTestId('navitem-node-overview'),
          summary: this.page.getByTestId('navitem-node-summary'),
          cpuUtilization: this.page.getByTestId('navitem-cpu-utilization'),
          disk: this.page.getByTestId('navitem-disk'),
          memory: this.page.getByTestId('navitem-memory'),
          network: this.page.getByTestId('navitem-network'),
          temperature: this.page.getByTestId('navitem-temperature'),
          numa: this.page.getByTestId('navitem-numa'),
          processes: this.page.getByTestId('navitem-processes'),
          otherDashboards: this.page.getByTestId('navitem-system-other-dashboards'),
        },
      },
      alldashboards: {
        locator: this.page.getByTestId('navitem-dashboards'),
        elements: {
          browseall: this.page.getByTestId('navitem-dashboards-browse'),
          shared: this.page.getByTestId('navitem-dashboards-shared'),
          playlists: this.page.getByTestId('navitem-dashboards-playlists'),
          snapshots: this.page.getByTestId('navitem-dashboards-snapshots'),
          libraryPanels: this.page.getByTestId('navitem-dashboards-library-panels'),
        },
      },
      explore: {
        locator: this.page.getByTestId('navitem-explore'),
        elements: {
          promSqlBuilder: this.page.getByTestId('navitem-explore-promsql-builder'),
          metrics: this.page.getByTestId('navitem-explore-metrics'),
        },
      },
      alerts: {
        locator: this.page.getByTestId('navitem-alerts'),
        elements: {
          firedAlerts: this.page.getByTestId('navitem-alerts-fired'),
          alertRules: this.page.getByTestId('navitem-alerts-rules'),
          contactPoints: this.page.getByTestId('navitem-alerts-contact-points'),
          notificationPolicies: this.page.getByTestId('navitem-alerts-policies'),
          silences: this.page.getByTestId('navitem-alerts-silences'),
          alertGroups: this.page.getByTestId('navitem-alerts-groups'),
          alertSettings: this.page.getByTestId('navitem-alerts-settings'),
          perconaAlertTemplates: this.page.getByTestId('navitem-alerts-templates'),
        },
      },
      perconaadvisors: {
        locator: this.page.getByTestId('navitem-advisors'),
        elements: {
          insights: this.page.getByTestId('navitem-advisors-insights'),
          configurtaion: this.page.getByTestId('navitem-advisors-configuration'),
          performance: this.page.getByTestId('navitem-advisors-performance'),
          query: this.page.getByTestId('navitem-advisors-query'),
          security: this.page.getByTestId('navitem-advisors-security'),
        },
      },
      inventory: {
        locator: this.page.getByTestId('navitem-inventory'),
        elements: {
          addServices: this.page.getByTestId('navitem-add-instance'),
          services: this.page.getByTestId('navitem-inventory-services'),
          nodes: this.page.getByTestId('navitem-inventory-nodes'),
        },
      },
      backups: {
        locator: this.page.getByTestId('navitem-backups'),
        elements: {
          allBackups: this.page.getByTestId('navitem-backup-inventory'),
          scheduledJobs: this.page.getByTestId('navitem-scheduled-backups'),
          restores: this.page.getByTestId('navitem-restore-history'),
          storageLocation: this.page.getByTestId('navitem-storage-locations'),
        },
      },
      configuration: {
        locator: this.page.getByTestId('navitem-configuration'),
        elements: {
          settings: this.page.getByTestId('navitem-configuration-settings'),
          updates: this.page.getByTestId('navitem-updates'),
          orgManagement: this.page.getByTestId('navitem-org-management'),
          org: {
            organizations: this.page.getByTestId('navitem-organizations'),
            statsAndLicense: this.page.getByTestId('navitem-stats-and-licenses'),
            defaultPreferences: this.page.getByTestId('navitem-default-preferences'),
          },
        },
      },
      usersAndAccess: {
        locator: this.page.getByTestId('navitem-users-and-access'),
        elements: {
          users: this.page.getByTestId('navitem-users'),
          teams: this.page.getByTestId('navitem-teams'),
          serviceAccounts: this.page.getByTestId('navitem-service-accounts'),
        },
      },
      accounts: {
        locator: this.page.getByTestId('navitem-account'),
        elements: {
          profile: this.page.getByTestId('navitem-profile'),
          notificationHistory: this.page.getByTestId('navitem-notification-history'),
          changePassword: this.page.getByTestId('navitem-password-change'),
          changeTheme: this.page.getByTestId('navitem-theme-toggle'),
          signOut: this.page.getByTestId('navitem-sign-out'),
        },
      },*/,
    };

    this.elements = {
      sidebar: this.page.getByTestId('pmm-sidebar'),
      iframe: this.page.locator('//*[@id="grafana-iframe"]'),
      closeLeftNavigationButton: this.page.getByTestId('sidebar-close-button'),
      openLeftNavigationButton: this.page.getByTestId('sidebar-open-button'),
      dumpLogs: this.page.getByTestId('help-card-pmm-dump-logs'),
      timePickerOpenButton: this.grafanaIframe().getByTestId('data-testid TimePicker Open Button'),
      refreshButton: this.grafanaIframe().getByTestId('data-testid RefreshPicker run button'),
      oldLeftMenu: this.page.getByTestId('data-testid navigation mega-menu'),
    };
  }

  public selectMenuItem = async (path: string): Promise<void> => {
    await pmmTest.step(`Select menu item: ${path}`, async () => {
      const keys = path.split('.');
      let element: any = this.buttons;
      for (const key of keys) {
        if (!element || typeof element !== 'object') break;
        if (Object.prototype.hasOwnProperty.call(element, key)) {
          element = element[key];
          continue;
        }
        if (element.elements && Object.prototype.hasOwnProperty.call(element.elements, key)) {
          element = element.elements[key];
          continue;
        }
        element = undefined;
      }
      if (element) {
        if (element.locator && typeof (element.locator as Locator).click === 'function') {
          await (element.locator as Locator).click();
          return;
        }
        if (typeof (element as Locator).click === 'function') {
          await (element as Locator).click();
          return;
        }
      }
    });
  };

  public mouseHoverOnPmmLogo = async (): Promise<void> => {
    await pmmTest.step('Hover on PMM Logo', async () => {
      const pmmLogo = this.elements.sidebar.locator('rect').first();
      const rectBox = await pmmLogo.boundingBox();
      if (rectBox) {
        await this.page.mouse.move(rectBox.x + rectBox.width / 2, rectBox.y + rectBox.height / 2);
      }
    });
  };

  variableContext = (text: string): Locator => {
    return this.grafanaIframe().getByText(text, { exact: true }).first();
  };

  public traverseAllMenuItems = async (
    menuItem: (locator: Locator, res: Response | null) => Promise<void>,
  ): Promise<void> => {
    const ignore404 = (url: string) => url.includes('/settings') || url.includes('/admin_config');
    const traverse = async (node: any, path: string): Promise<void> => {
      if (!node || typeof node !== 'object') return;
      const locator =
        node.locator && typeof node.locator !== 'function'
          ? node.locator
          : typeof node.click === 'function'
            ? node
            : null;
      if (locator) {
        const responsePromise = this.page
          .waitForResponse((res: Response) => !ignore404(res.url()), { timeout: 10000 })
          .catch(() => null);
        await locator.click();
        const res = await responsePromise;
        await menuItem(locator, res);
      }
      const children = node.elements || (node === locator ? null : node);
      if (!children) return;
      for (const [key, value] of Object.entries(children)) {
        if (['locator', 'elements', 'verifyTimeRange', 'page', 'signOut'].includes(key)) continue;
        await traverse(value, path ? `${path}.${key}` : key);
      }
    };
    await traverse(this.buttons, '');
  };

  public dashboardsToVerifyTimeRange(): string[] {
    const dashboards: string[] = [];
    const traverse = (node: any, path: string): void => {
      if (!node || typeof node !== 'object') return;
      if (node.verifyTimeRange === true) {
        dashboards.push(path);
      }
      if (node.elements && typeof node.elements === 'object') {
        for (const [key, value] of Object.entries(node.elements)) {
          traverse(value, path ? `${path}.${key}` : key);
        }
      }
    };
    for (const [key, value] of Object.entries(this.buttons)) {
      traverse(value, key);
    }
    return dashboards;
  }
}
