import MysqlInstanceOverview from './mysqlInstanceOverview';
import MysqlInstanceSummary from './mysqlInstanceSummary';
import MySQLInstancesCompare from './mysqlInstancesCompare';
import PXCGaleraClusterSummary from './pxcGaleraClusterSummary';
import PXCGaleraNodesCompare from './pxcGaleraNodesCompare';
import PXCGaleraNodeSummary from './pxcGaleraNodeSummary';
import ProxysqlInstanceSummary from './proxysqlInstanceSummary';
import MySQLUserDetails from './mysqlUserDetails';
import MysqlGroupReplicationSummary from './mysqlGroupReplicationSummary';
import MysqlMyRocksDetails from './mysqlMyRocksDetails';
import MysqlPerformanceSchemaDetails from './mysqlPerformanceSchemaDetails';
import MysqlReplicationSummary from './mysqlReplicationSummary';
import HaproxyInstanceSummary from './haproxyInstanceSummary';
import MysqlWaitEventAnalysesDetails from './mysqlWaitEventAnalysesDetails';
import MysqlCommandHandlerCountersCompare from './mysqlCommandHandlerCountersCompare';
import MysqlInnoDBCompressionDetails from './mysqlInnodbCompressionDetails';
import DashboardInterface from '@interfaces/dashboard';

export const MysqlDashboards = {
  haproxyInstanceSummary: new HaproxyInstanceSummary(),
  mysqlCommandHandlerCountersCompare: new MysqlCommandHandlerCountersCompare(),
  mysqlGroupReplicationSummary: new MysqlGroupReplicationSummary(),
  mysqlInnodbCompressionDetails: new MysqlInnoDBCompressionDetails(),
  mysqlInstanceOverview: new MysqlInstanceOverview(),
  mysqlInstancesCompare: new MySQLInstancesCompare(),
  mysqlInstanceSummary: new MysqlInstanceSummary(),
  mysqlMyRocksDetails: new MysqlMyRocksDetails(),
  mysqlPerformanceSchemaDetails: new MysqlPerformanceSchemaDetails(),
  mysqlReplicationSummary: new MysqlReplicationSummary(),
  mysqlUserDetails: new MySQLUserDetails(),
  mysqlWaitEventAnalysesDetails: new MysqlWaitEventAnalysesDetails(),
  proxysqlInstanceSummary: new ProxysqlInstanceSummary(),
  pxcGaleraClusterSummary: new PXCGaleraClusterSummary(),
  pxcGaleraNodesCompare: new PXCGaleraNodesCompare(),
  pxcGaleraNodeSummary: new PXCGaleraNodeSummary(),
};

export type MysqlDashboardsType = typeof MysqlDashboards & Record<string, DashboardInterface>;

export default MysqlDashboards;
