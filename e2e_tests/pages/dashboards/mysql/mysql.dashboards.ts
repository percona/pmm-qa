import MysqlInstanceOverview from './mysqlInstanceOverview';
import MysqlInstanceSummary from './mysqlInstanceSummary';
import MySQLInstancesCompare from './mysqlInstancesCompare';
import PXCGaleraClusterSummary from './pxcGaleraClusterSummary';
import PXCGaleraNodesCompare from './pxcGaleraNodesCompare';
import MySQLUserDetails from './mysqlUserDetails';

export default class MysqlDashboards {
  readonly mysqlInstanceOverview: MysqlInstanceOverview;
  readonly mysqlInstanceSummary: MysqlInstanceSummary;
  readonly mysqlInstancesCompare: MySQLInstancesCompare;
  readonly mysqlUserDetails: MySQLUserDetails;
  readonly pxcGaleraClusterSummary: PXCGaleraClusterSummary;
  readonly pxcGaleraNodesCompare: PXCGaleraNodesCompare;

  constructor() {
    this.mysqlInstanceOverview = new MysqlInstanceOverview();
    this.mysqlInstanceSummary = new MysqlInstanceSummary();
    this.mysqlInstancesCompare = new MySQLInstancesCompare();
    this.mysqlUserDetails = new MySQLUserDetails();
    this.pxcGaleraClusterSummary = new PXCGaleraClusterSummary();
    this.pxcGaleraNodesCompare = new PXCGaleraNodesCompare();
  }
}
