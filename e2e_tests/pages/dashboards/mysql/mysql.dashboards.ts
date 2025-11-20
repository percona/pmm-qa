import MysqlInstanceOverview from './mysqlInstanceOverview';
import MysqlInstanceSummary from './mysqlInstanceSummary';
import MySQLInstancesCompare from './mysqlInstancesCompare';
import PXCGaleraClusterSummary from './pxcGaleraClusterSummary';
import PXCGaleraNodesCompare from './pxcGaleraNodesCompare';
import MySQLUserDetails from './mysqlUserDetails';
import MysqlGroupReplicationSummary from './mysqlGroupReplicationSummary';
import MysqlMyRocksDetails from './mysqlMyRocksDetails';
import MysqlReplicationSummary from './mysqlReplicationSummary';

export default class MysqlDashboards {
  readonly mysqlGroupReplicationSummary: MysqlGroupReplicationSummary;
  readonly mysqlInstanceOverview: MysqlInstanceOverview;
  readonly mysqlInstanceSummary: MysqlInstanceSummary;
  readonly mysqlInstancesCompare: MySQLInstancesCompare;
  readonly mysqlMyRocksDetails: MysqlMyRocksDetails;
  readonly mysqlReplicationSummary: MysqlReplicationSummary;
  readonly mysqlUserDetails: MySQLUserDetails;
  readonly pxcGaleraClusterSummary: PXCGaleraClusterSummary;
  readonly pxcGaleraNodesCompare: PXCGaleraNodesCompare;

  constructor() {
    this.mysqlGroupReplicationSummary = new MysqlGroupReplicationSummary();
    this.mysqlInstanceOverview = new MysqlInstanceOverview();
    this.mysqlInstanceSummary = new MysqlInstanceSummary();
    this.mysqlInstancesCompare = new MySQLInstancesCompare();
    this.mysqlMyRocksDetails = new MysqlMyRocksDetails();
    this.mysqlReplicationSummary = new MysqlReplicationSummary();
    this.mysqlUserDetails = new MySQLUserDetails();
    this.pxcGaleraClusterSummary = new PXCGaleraClusterSummary();
    this.pxcGaleraNodesCompare = new PXCGaleraNodesCompare();
  }
}
