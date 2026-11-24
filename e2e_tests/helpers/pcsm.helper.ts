import CliHelper from '@helpers/cli.helper';

const EXIT_WAIT_SECONDS = 30;

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

  /** pkill only reports the signal delivered: wait for the exit, or a `start` right after sees the dying process and skips. */
  stop = (instance: string) => {
    this.cliHelper.execSilent(`docker exec ${instance} pkill -x pcsm`).assertSuccess();
    this.cliHelper
      .execSilent(
        `docker exec ${instance} sh -c 'i=0; while pgrep -x pcsm >/dev/null; do i=$((i+1)); [ $i -gt ${EXIT_WAIT_SECONDS} ] && exit 1; sleep 1; done'`,
        (EXIT_WAIT_SECONDS + 10) * 1_000,
      )
      .assertSuccess();
  };
}
