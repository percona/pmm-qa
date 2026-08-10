import fs from 'node:fs';
import path from 'node:path';

/**
 * Persists small pieces of state to disk so they survive between the
 * `@pre-upgrade` and `@post-upgrade` test runs (which execute as two separate
 * Playwright processes, with a PMM server upgrade in between).
 *
 * Environment variables / `export` cannot be used for this: every
 * {@link CliHelper.execSilent} call spawns its own short-lived child shell, so
 * nothing set there outlives the call, let alone the whole process.
 *
 * The file lives under `output/` (git-ignored) by default. Override the
 * location with the `UPGRADE_STATE_FILE` env var if `output/` is cleaned
 * between the two runs in your pipeline.
 */
export default class UpgradeState {
  private static readonly file =
    process.env.UPGRADE_STATE_FILE || path.resolve(__dirname, '..', 'output', 'upgrade-state.json');

  /** Read a single value, throwing a clear error if it was never saved. */
  static get = (key: string): string => {
    const value = UpgradeState.readAll()[key];

    if (!value) {
      throw new Error(
        `Upgrade state "${key}" not found in ${UpgradeState.file}. ` +
          'Did the matching @pre-upgrade test run and save it before the upgrade?',
      );
    }

    return value;
  };

  /** Read the whole state object, or `{}` if nothing has been saved yet. */
  static readAll = (): Record<string, string> => {
    try {
      return JSON.parse(fs.readFileSync(UpgradeState.file, 'utf8'));
    } catch {
      return {};
    }
  };

  /** Merge the given key/value pairs into the persisted state. */
  static save = (data: Record<string, string>): void => {
    fs.mkdirSync(path.dirname(UpgradeState.file), { recursive: true });
    fs.writeFileSync(UpgradeState.file, JSON.stringify({ ...UpgradeState.readAll(), ...data }, null, 2));
  };
}
