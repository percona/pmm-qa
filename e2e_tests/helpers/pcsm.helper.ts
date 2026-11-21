import CliHelper from '@helpers/cli.helper';

export default class PcsmHelper {
  constructor(private readonly cliHelper: CliHelper) {}

  /** Documents the source workload has written to the target, through PCSM. */
  countTargetOrders = () =>
    Number(
      this.cliHelper
        .execSilent(
          `docker exec pcsm-tgt-1 mongo --quiet mongodb://root:root@127.0.0.1:27017/admin --eval 'db.getSiblingDB("pcsm_qa").orders.countDocuments({})'`,
        )
        .assertSuccess()
        .getStdOutLines()
        .pop(),
    );

  /** Starts PCSM the way setup_pcsm does, unless it is already running. */
  start = (instance: string) => {
    if (this.cliHelper.execSilent(`docker exec ${instance} pgrep -x pcsm`).code !== 0) {
      this.cliHelper
        .execSilent(`docker exec --detach ${instance} sh -c 'exec pcsm >>/var/log/pcsm.log 2>&1'`)
        .assertSuccess();
    }
  };

  stop = (instance: string) =>
    this.cliHelper.execSilent(`docker exec ${instance} pkill -x pcsm`).assertSuccess();
}
