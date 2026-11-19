import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export type TelemetryCapture = Record<string, string>;

const captureMarker = '@@CAPTURE@@';

/** A key reported more than once keeps all its values, one per line, so it matches no single value. */
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
      .map((block) => {
        const capture: TelemetryCapture = {};

        for (const line of block.split('\n').filter((entry) => entry.includes(': '))) {
          const key = line.slice(0, line.indexOf(': '));
          const value = line.slice(line.indexOf(': ') + 2);

          capture[key] = key in capture ? `${capture[key]}\n${value}` : value;
        }

        return capture;
      });
  };

  /** Milliseconds since the epoch of the first log entry with a line matching the awk regex `pattern`. */
  entryTime = (pattern: string): number =>
    Date.parse(
      this.cliHelper
        .execSilent(
          `docker exec ${this.container} awk '/^time=/{t=$0} /${pattern}/{print t; exit}' /srv/logs/pmm-managed.log`,
        )
        .assertSuccess()
        .stdout.match(/^time="?([^" ]+)/)?.[1] ?? '',
    );

  /** `{"v":[{"1":"<label>","2":"<value>"}]}`, the shape of the JSON-transformed VictoriaMetrics keys. */
  static jsonEntries = (value: string | undefined): [string, string][] =>
    ((JSON.parse(value ?? '{"v":[]}') as { v: Record<string, string>[] }).v ?? []).map(
      (entry) => [entry['1'], entry['2']] as [string, string],
    );

  latestCapture = (keys?: string[]): TelemetryCapture => {
    const capture = this.captures().at(-1) ?? {};

    return keys ? Object.fromEntries(keys.map((key) => [key, capture[key]])) : capture;
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
