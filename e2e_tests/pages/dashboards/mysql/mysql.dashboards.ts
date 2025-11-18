import MysqlInstanceOverview from './mysqlInstanceOverview';
import MysqlInstanceSummary from './mysqlInstanceSummary';
import MySQLInstancesCompare from './mysqlInstancesCompare';

export default class MysqlDashboards {
  readonly mysqlInstanceOverview: MysqlInstanceOverview;
  readonly mysqlInstanceSummary: MysqlInstanceSummary;
  readonly mysqlInstancesCompare: MySQLInstancesCompare;

  constructor() {
    this.mysqlInstanceOverview = new MysqlInstanceOverview();
    this.mysqlInstanceSummary = new MysqlInstanceSummary();
    this.mysqlInstancesCompare = new MySQLInstancesCompare();
  }
}
