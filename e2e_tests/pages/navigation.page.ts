import { expect, Page } from "@playwright/test";

export default class LeftNavigation {
    constructor(public page: Page) { }

    public get elements() {
        return {
            // parent menu items
            home: this.page.locator('//*[@data-testid="navitem-home-page"]'),
            mysql: this.page.locator('//*[@data-testid="navitem-mysql"]'),
            postgresql: this.page.locator('//*[@data-testid="navitem-postgre"]'),
            mongodb: this.page.locator('//*[@data-testid="navitem-mongo"]'),
            operatingsystem: this.page.locator('//*[@data-testid="navitem-system"]'),
            alldashboards: this.page.locator('//*[@data-testid="navitem-dashboards"]'),
            qan: this.page.locator('//*[@data-testid="navitem-qan"]'),
            explore: this.page.locator('//*[@data-testid="navitem-explore"]'),
            alerts: this.page.locator('//*[@data-testid="navitem-alerts"]'),
            perconaadvisors: this.page.locator('//*[@data-testid="navitem-advisors"]'),
            inventory: this.page.locator('//*[@data-testid="navitem-inventory"]'),
            backups: this.page.locator('//*[@data-testid="navitem-backups"]'),
            configuration: this.page.locator('//*[@data-testid="navitem-configuration"]'),
            usersAndAccess: this.page.locator('//*[@data-testid="navitem-users-and-access"]'),
            accounts: this.page.locator('//*[@data-testid="navitem-account"]'),
            help: this.page.locator('//*[@data-testid="navitem-help"]'),


            mysqlMenu: {
                overview: this.page.locator('//*[@data-testid="navitem-mysql-overview"]'),
                summary: this.page.locator('//*[@data-testid="navitem-mysql-summary"]'),
                highAvailability: this.page.locator('//*[@data-testid="navitem-mysql-high-availability"]'),
                ha: {
                    groupReplication: this.page.locator('//*[@data-testid="navitem-mysql-group-replication-summary"]'),
                    replication: this.page.locator('//*[@data-testid="navitem-mysql-replication-summary"]'),
                    pxcGaleraCluster: this.page.locator('//*[@data-testid="navitem-pxc-cluster-summary"]'),
                    pxcGaleraNode: this.page.locator('//*[@data-testid="navitem-pxc-node-summary"]'),
                    pxcGaleraNodes: this.page.locator('//*[@data-testid="navitem-pxc-nodes-compare"]'),
                },
                commandHandler: this.page.locator('//*[@data-testid="navitem-mysql-command-handler-counters-compare"]'),
                innodbDetails: this.page.locator('//*[@data-testid="navitem-mysql-innodb-details"]'),
                innodbCompression: this.page.locator('//*[@data-testid="navitem-mysql-innodb-compression-details"]'),
                performanceSchema: this.page.locator('//*[@data-testid="navitem-mysql-performance-schema-details"]'),
                queryResponseTime: this.page.locator('//*[@data-testid="navitem-mysql-query-response-time-details"]'),
                tableDetails: this.page.locator('//*[@data-testid="navitem-mysql-table-details"]'),
                tokudbDetails: this.page.locator('//*[@data-testid="navitem-mysql-tokudb-details"]'),
                otherDashboards: this.page.locator('//*[@data-testid="navitem-mysql-other-dashboards"]'),

            },
            postgresqlMenu: {
                overview: this.page.locator('//*[@data-testid="navitem-postgresql-overwiew"]'),
                summary: this.page.locator('//*[@data-testid="navitem-postgresql-summary"]'),
                highAvailability: this.page.locator('//*[@data-testid="navitem-postgresql-ha"]'),
                ha: {
                    replication: this.page.locator('//*[@data-testid="navitem-postgresql-replication"]'),
                    patroni: this.page.locator('//*[@data-testid="navitem-postgresql-patroni"]'),
                },
                topQueries: this.page.locator('//*[@data-testid="navitem-postgresql-top-queries"]'),
                otherDashboards: this.page.locator('//*[@data-testid="navitem-postgre-other-dashboards"]'),

            },

            mongodbMenu: {
                overview: this.page.locator('//*[@data-testid="navitem-mongo-overview"]'),
                summary: this.page.locator('//*[@data-testid="navitem-mongo-summary"]'),
                highAvailability: this.page.locator('//*[@data-testid="navitem-mongo-high-availability"]'),
                ha: {
                    cluster: this.page.locator('//*[@data-testid="navitem-mongo-cluster-summary"]'),
                    replSet: this.page.locator('//*[@data-testid="navitem-mongo-rplset-summary"]'),
                    router: this.page.locator('//*[@data-testid="navitem-mongo-router-summary"]'),
                },
                inMemory: this.page.locator('//*[@data-testid="navitem-mongo-memory-details"]'),
                wiredTiger: this.page.locator('//*[@data-testid="navitem-mondo-wiredtiger-details"]'),
                collections: this.page.locator('//*[@data-testid="navitem-mongo-collections-overview"]'),
                oplog: this.page.locator('//*[@data-testid="navitem-mongo-oplog-details"]'),
                otherDashboards: this.page.locator('//*[@data-testid="navitem-mongo-other-dashboards"]'),

            },

            operatingsystemMenu: {
                overview: this.page.locator('//*[@data-testid="navitem-node-overview"]'),
                summary: this.page.locator('//*[@data-testid="navitem-node-summary"]'),
                cpuUtilization: this.page.locator('//*[@data-testid="navitem-cpu-utilization"]'),
                disk: this.page.locator('//*[@data-testid="navitem-disk"]'),
                memory: this.page.locator('//*[@data-testid="navitem-memory"]'),
                network: this.page.locator('//*[@data-testid="navitem-network"]'),
                temperature: this.page.locator('//*[@data-testid="navitem-temperature"]'),
                numa: this.page.locator('//*[@data-testid="navitem-numa"]'),
                processes: this.page.locator('//*[@data-testid="navitem-processes"]'),
                otherDashboards: this.page.locator('//*[@data-testid="navitem-system-other-dashboards"]'),
            },

            alldashboardsMenu: {
                browseall: this.page.locator('//*[@data-testid="navitem-dashboards-browse"]'),
                shared: this.page.locator('//*[@data-testid="navitem-dashboards-shared"]'),
                playlists: this.page.locator('//*[@data-testid="navitem-dashboards-playlists"]'),
                snapshots: '//*[@data-testid="navitem-dashboards-snapshots"]',
                libraryPanels: '//*[@data-testid="navitem-dashboards-library-panels"]',
            },

            exploreMenu: {
                promSqlBuilder: this.page.locator('//*[@data-testid="navitem-explore-promsql-builder"]'),
                metrics: this.page.locator('//*[@data-testid="navitem-explore-metrics"]'),
            },

            alertsMenu: {
                firedAlerts: this.page.locator('//*[@data-testid="navitem-alerts-fired"]'),
                alertRules: this.page.locator('//*[@data-testid="navitem-alerts-rules"]'),
                contactPoints: this.page.locator('//*[@data-testid="navitem-alerts-contact-points"]'),
                notificationPolicies: this.page.locator('//*[@data-testid="navitem-alerts-policies"]'),
                silences: this.page.locator('//*[@data-testid="navitem-alerts-silences"]'),
                alertGroups: this.page.locator('//*[@data-testid="navitem-alerts-groups"]'),
                alertSettings: this.page.locator('//*[@data-testid="navitem-alerts-settings"]'),
                perconaAlertTemplates: this.page.locator('//*[@data-testid="navitem-alerts-templates"]'),
            },
            perconaadvisorsMenu: {
                insights: this.page.locator('//*[@data-testid="navitem-advisors-insights"]'),
                configurtaion: this.page.locator('//*[@data-testid="navitem-advisors-configuration"]'),
                performance: this.page.locator('//*[@data-testid="navitem-advisors-performance"]'),
                query: this.page.locator('//*[@data-testid="navitem-advisors-query"]'),
                security: this.page.locator('//*[@data-testid="navitem-advisors-security"]'),
            },

            inventoryMenu: {
                addServices: this.page.locator('//*[@data-testid="navitem-add-instance"]'),
                services: this.page.locator('//*[@data-testid="navitem-inventory-services"]'),
                nodes: this.page.locator('//*[@data-testid="navitem-inventory-nodes"]'),
            },

            backupsMenu: {
                allBackups: this.page.locator('//*[@data-testid="navitem-backup-inventory"]'),
                scheduledJobs: this.page.locator('//*[@data-testid="navitem-scheduled-backups"]'),
                restores: this.page.locator('//*[@data-testid="navitem-restore-history"]'),
                storageLocation: this.page.locator('//*[@data-testid="navitem-storage-locations"]'),
            },

            configurationMenu: {
                settings: this.page.locator('//*[@data-testid="navitem-configuration-settings"]'),
                updates: this.page.locator('//*[@data-testid="navitem-updates"]'),
                orgManagement: this.page.locator('//*[@data-testid="navitem-org-management"]'),
                org: {
                    organizations: this.page.locator('//*[@data-testid="navitem-organizations"]'),
                    statsAndLicense: this.page.locator('//*[@data-testid="navitem-stats-and-licenses"]'),
                    defaultPreferences: this.page.locator('//*[@data-testid="navitem-default-preferences"]'),
                }
            },

            usersAndAccessMenu: {
                users: this.page.locator('//*[@data-testid="navitem-users"]'),
                teams: this.page.locator('//*[@data-testid="navitem-teams"]'),
                serviceAccounts: this.page.locator('//*[@data-testid="navitem-service-accounts"]'),

            },

            accountsMenu: {
                profile: this.page.locator('//*[@data-testid="navitem-profile"]'),
                notificationHistory: this.page.locator('//*[@data-testid="navitem-notification-history"]'),
                changePassword: this.page.locator('//*[@data-testid="navitem-password-change"]'),
                changeTheme: this.page.locator('//*[@data-testid="navitem-theme-toggle"]'),
                signOut: this.page.locator('//*[@data-testid="navitem-sign-out"]'),
            },

            // Sidebar items and other elements
            closeLeftNavigationButton: this.page.locator('//*[@data-testid="sidebar-close-button"]'),
            openLeftNavigationButton: this.page.locator('//*[@data-testid="sidebar-open-button"]'),
            sidebar: this.page.locator('//*[@data-testid="pmm-sidebar"]'),

            // help card dump logs
            dumpLogs: this.page.locator('//*[@data-testid="help-card-pmm-dump-logs"]'),

            // time picker (within iframe)
            iframe: this.page.locator('#grafana-iframe'),
            timePickerOpenButton: this.page.frameLocator('#grafana-iframe').locator('//*[@data-testid="data-testid TimePicker Open Button"]'),
            refreshButton: this.page.frameLocator('#grafana-iframe').locator('//*[@data-testid="data-testid RefreshPicker run button"]'),

            // old navigation 
            oldLeftMenu: this.page.locator('//*[@data-testid="data-testid navigation mega-menu"]'),
        };
    }

    getTimeRangeOption = (timeRange: string) => {
        return this.page.frameLocator('#grafana-iframe').locator(`//*[contains(text(), "${timeRange}")]`);
    };

    ignore404 = (url: string) => (
        url.includes('/settings') ||
        url.includes('/admin_config')
    );

    responseAfterClick = async (locator: any, name: string) => {
        const response = this.page.waitForResponse(
            res => !this.ignore404(res.url()), { timeout: 2000 }
        ).catch(() => null);

        await locator.click();
        const res = await response;

        if (res) {
            expect(res.status()).not.toBe(404);
        }

        await expect(this.page).not.toHaveURL(/404|error|not-found/i);
    };

    traverseMenuItems = async (child: any, parent: string) => {

        const items = Object.entries(child)

        for (const [key, value] of items) {
            if (key === 'signOut') {
                await this.responseAfterClick(value, `${parent}.${key}`);
                return;
            }

            if (typeof value === 'string') {
                const locator = this.page.locator(value);
                await this.responseAfterClick(locator, `${parent}.${key}`);
            } else if (typeof value === 'object' && value !== null) {
                // Check if it looks like a Locator (duck typing)
                if (typeof (value as any).click === 'function') {
                    await this.responseAfterClick(value, `${parent}.${key}`);
                } else {
                    await this.traverseMenuItems(value, `${parent}.${key}`);
                }
            }
        }
    };

    traverseAllMenuItems = async () => {
        const simpleMenuItems = ['home', 'qan', 'help'];

        const menuWithChildren = [
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
        ];

        for (const item of simpleMenuItems) {
            await this.responseAfterClick((this.elements as any)[item], item);
        }

        for (const parent of menuWithChildren) {
            await this.responseAfterClick((this.elements as any)[parent], parent);

            const children = (this.elements as any)[`${parent}Menu`];
            if (children) {
                await this.traverseMenuItems(children, parent);
            }
        }
    };

    verifyTimeRangePersistence = async (selectedTimeRange: string) => {

        const dashboards = [
            { parent: this.elements.mysql, child: null },
            { parent: null, child: this.elements.mysqlMenu.summary },
            { parent: this.elements.mysqlMenu.highAvailability, child: null },
            { parent: null, child: this.elements.mysqlMenu.ha.replication },
            { parent: this.elements.postgresql, child: null },
            { parent: this.elements.operatingsystem, child: null },
            { parent: this.elements.help, child: null },
            { parent: this.elements.home, child: null }
        ];

        for (const dashboard of dashboards) {
            if (dashboard.parent) {
                await dashboard.parent.click();
            }
            if (dashboard.child) {
                await dashboard.child.click();
            }

            await expect(this.elements.timePickerOpenButton).toContainText(selectedTimeRange);
        };

    };

    mouseHoverOnPmmLogo = async () => {
        const pmmLogo = this.elements.sidebar.locator('rect');

        const rectBox = await pmmLogo.boundingBox();
        if (rectBox) {
            await this.page.mouse.move(
                rectBox.x + rectBox.width / 2,
                rectBox.y + rectBox.height / 2
            );
        }
    };
}
