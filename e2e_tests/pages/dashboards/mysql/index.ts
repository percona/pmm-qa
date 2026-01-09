import MysqlInstanceOverview from './mysqlInstanceOverview';
import MysqlInstanceSummary from './mysqlInstanceSummary';
import MySQLInstancesCompare from './mysqlInstancesCompare';
import PXCGaleraClusterSummary from './pxcGaleraClusterSummary';
import PXCGaleraNodesCompare from './pxcGaleraNodesCompare';
import MySQLUserDetails from './mysqlUserDetails';
import MysqlGroupReplicationSummary from './mysqlGroupReplicationSummary';
import MysqlMyRocksDetails from './mysqlMyRocksDetails';
import MysqlReplicationSummary from './mysqlReplicationSummary';
import HaproxyInstanceSummary from './haproxyInstanceSummary';
import MysqlWaitEventAnalysesDetails from './mysqlWaitEventAnalysesDetails';
import MysqlCommandHandlerCountersCompare from './mysqlCommandHandlerCountersCompare';
import MysqlInnoDBCompressionDetails from './mysqlInnodbCompressionDetails';

const MysqlDashboards = {
  haproxyInstanceSummary: new HaproxyInstanceSummary(),
  mysqlCommandHandlerCountersCompare: new MysqlCommandHandlerCountersCompare(),
  mysqlGroupReplicationSummary: new MysqlGroupReplicationSummary(),
  mysqlInnodbCompressionDetails: new MysqlInnoDBCompressionDetails(),
  mysqlInstanceOverview: new MysqlInstanceOverview(),
  mysqlInstanceSummary: new MysqlInstanceSummary(),
  mysqlInstancesCompare: new MySQLInstancesCompare(),
  mysqlMyRocksDetails: new MysqlMyRocksDetails(),
  mysqlReplicationSummary: new MysqlReplicationSummary(),
  mysqlUserDetails: new MySQLUserDetails(),
  mysqlWaitEventAnalysesDetails: new MysqlWaitEventAnalysesDetails(),
  pxcGaleraClusterSummary: new PXCGaleraClusterSummary(),
  pxcGaleraNodesCompare: new PXCGaleraNodesCompare(),MysqlInstanceOverview
};

export default MysqlDashboards;
