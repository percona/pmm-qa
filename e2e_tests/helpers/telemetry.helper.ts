import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export type TelemetryCapture = Record<string, string>;

const captureMarker = '@@CAPTURE@@';

/**
 * Reads the reports pmm-managed logs as "Telemetry captured:" when it runs with PMM_DEBUG=1.
 * A report is one log entry of `key: value` lines, so it ends at the next `time=` line.
 */
export default class TelemetryHelper {
  constructor(
    private readonly cliHelper: CliHelper,
    readonly container: string,
  ) {}

  captures = (): TelemetryCapture[] => {
    const { stdout } = this.cliHelper
      .execSilent(
        `docker exec ${this.container} awk '/^Telemetry captured:/{print "${captureMarker}"; f=1; next} /^time=/{f=0} f && NF' /srv/logs/pmm-managed.log`,
      )
      .assertSuccess();

    return stdout
      .split(`${captureMarker}\n`)
      .slice(1)
      .map((block) =>
        Object.fromEntries(
          block
            .split('\n')
            .filter((line) => line.includes(': '))
            .map((line) => [line.slice(0, line.indexOf(': ')), line.slice(line.indexOf(': ') + 2)]),
        ),
      );
  };

  grepLog = (pattern: string): string =>
    this.cliHelper.execSilent(`docker exec ${this.container} grep -F "${pattern}" /srv/logs/pmm-managed.log`)
      .stdout;

  /** `{"v":[{"1":"<label>","2":"<value>"}]}`, the shape of the JSON-transformed VictoriaMetrics keys. */
  static jsonEntries = (value: string | undefined): [string, string][] =>
    ((JSON.parse(value ?? '{"v":[]}') as { v: Record<string, string>[] }).v ?? []).map(
      (entry) => [entry['1'], entry['2']] as [string, string],
    );

  // VictoriaMetrics-backed keys lag a scrape behind the database-backed ones.
  waitForCaptureMatching = async (
    expected: TelemetryCapture,
    timeout = Timeouts.FIVE_MINUTES,
  ): Promise<TelemetryCapture> => {
    let capture = await this.waitForFreshCapture();

    await expect
      .poll(
        () => {
          capture = this.captures().at(-1) as TelemetryCapture;

          return Object.fromEntries(Object.keys(expected).map((key) => [key, capture[key]]));
        },
        { message: 'The telemetry report never matched the expected values', timeout },
      )
      .toEqual(expected);

    return capture;
  };

  // Two reports, so the newest one began after the call, not while the state was changing.
  waitForFreshCapture = async (timeout = Timeouts.TWO_MINUTES): Promise<TelemetryCapture> => {
    const start = this.captures().length;
    let captures: TelemetryCapture[] = [];

    await expect
      .poll(() => (captures = this.captures()).length, {
        message: `pmm-managed in ${this.container} logged no new telemetry report`,
        timeout,
      })
      .toBeGreaterThanOrEqual(start + 2);

    return captures[captures.length - 1];
  };
}
