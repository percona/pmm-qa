import ValkeyClientsDashboard from '@pages/dashboards/valkey/valkeyClientsDashboard';
import ValkeyCommandDetailDashboard from '@pages/dashboards/valkey/valkeyCommandDetailDashboard';
import ValkeyClusterDetailsDashboard from '@pages/dashboards/valkey/valkeyClusterDetailsDashboard';
import ValkeyLoadDashboard from '@pages/dashboards/valkey/valkeyLoadDashboard';
import ValkeyMemoryDashboard from '@pages/dashboards/valkey/valkeyMemoryDashboard';
import ValkeyNetworkDashboard from '@pages/dashboards/valkey/valkeyNetworkDashboard';
import ValkeyOverviewDashboard from '@pages/dashboards/valkey/valkeyOverviewDashboard';
import ValkeyPersistenceDetailsDashboard from '@pages/dashboards/valkey/valkeyPersistenceDetailsDashboard';
import ValkeyReplicationDashboard from '@pages/dashboards/valkey/valkeyReplicationDashboard';
import ValkeySlowlogDashboard from '@pages/dashboards/valkey/valkeySlowlogDashboard';

const ValkeyDashboards = {
  valkeyClientsDashboard: new ValkeyClientsDashboard(),
  valkeyClusterDetailsDashboard: new ValkeyClusterDetailsDashboard(),
  valkeyCommandDetailDashboard: new ValkeyCommandDetailDashboard(),
  valkeyLoadDashboard: new ValkeyLoadDashboard(),
  valkeyMemoryDashboard: new ValkeyMemoryDashboard(),
  valkeyNetworkDashboard: new ValkeyNetworkDashboard(),
  valkeyOverviewDashboard: new ValkeyOverviewDashboard(),
  valkeyPersistenceDetailsDashboard: new ValkeyPersistenceDetailsDashboard(),
  valkeyReplicationDashboard: new ValkeyReplicationDashboard(),
  valkeySlowlogDashboard: new ValkeySlowlogDashboard(),
};

export default ValkeyDashboards;
