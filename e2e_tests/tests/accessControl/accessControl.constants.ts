import { AccessUserScenario } from '../../interfaces/accessControl';
import { GrafanaPanel } from '../../interfaces/grafanaPanel';

export const dashboardTimeRange = 'now-1h';
export const qanUrl = 'graph/d/pmm-qan/pmm-query-analytics';

const mysqlAllowedPanels: GrafanaPanel[] = [
  { name: 'Total Current QPS', type: 'stat' },
  { name: 'Max MySQL Uptime', type: 'stat' },
];
const postgresAllowedPanels: GrafanaPanel[] = [
  { name: 'Transactions per second', type: 'stat' },
  { name: 'Execution time', type: 'timeSeries' },
];
const mongoAllowedPanels: GrafanaPanel[] = [
  { name: 'Operations', type: 'stat' },
  { name: 'Docs Accessed', type: 'stat' },
];
const mysqlDisallowedPanels = mysqlAllowedPanels.map(({ name }) => name);
const postgresDisallowedPanels = postgresAllowedPanels.map(({ name }) => name);
const mongoDisallowedPanels = mongoAllowedPanels.map(({ name }) => name);

export const accessControlScenarios: AccessUserScenario[] = [
  {
    allowedPanels: mysqlAllowedPanels,
    disallowedDashboards: [
      { menuItem: 'postgresql', panels: postgresDisallowedPanels },
      { menuItem: 'mongodb', panels: mongoDisallowedPanels },
    ],
    password: 'mysql',
    role: { filter: '{service_type="mysql"}', title: 'mysql' },
    serviceType: 'mysql',
    username: 'mysql',
  },
  {
    allowedPanels: postgresAllowedPanels,
    disallowedDashboards: [
      { menuItem: 'mysql', panels: mysqlDisallowedPanels },
      { menuItem: 'mongodb', panels: mongoDisallowedPanels },
    ],
    password: 'postgres',
    role: { filter: '{service_type="postgresql"}', title: 'postgres' },
    serviceType: 'postgresql',
    username: 'postgres',
  },
  {
    allowedPanels: mongoAllowedPanels,
    disallowedDashboards: [
      { menuItem: 'mysql', panels: mysqlDisallowedPanels },
      { menuItem: 'postgresql', panels: postgresDisallowedPanels },
    ],
    password: 'mongo',
    role: { filter: '{service_type="mongodb"}', title: 'mongo' },
    serviceType: 'mongodb',
    username: 'mongo',
  },
];
