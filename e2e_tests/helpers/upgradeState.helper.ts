import fs from 'node:fs';
import path from 'node:path';

/**
 * Persists small pieces of state to disk so they survive between
 * test runs (which execute as two separate
 * Playwright processes, with a PMM server upgrade in between).
 *
 *
 * The file lives under `output/` (git-ignored) by default. Override the
 * location with the `UPGRADE_STATE_FILE` env var if `output/` is cleaned
 * between the two runs in your pipeline.
 */
export default class TestState {
  private readonly file =
    process.env.UPGRADE_STATE_FILE || path.resolve(__dirname, '..', 'output', 'upgrade-state.json');

  /** Read a single value, throwing a clear error if it was never saved. */
  get = (key: string): string => {
    const value = this.readAll()[key];

    if (!value) {
      throw new Error(
        `Upgrade state "${key}" not found in ${this.file}. ` +
          'Did the matching @pre-upgrade test run and save it before the upgrade?',
      );
    }

    return value;
  };

  /** Read the whole state object, or `{}` if nothing has been saved yet. */
  readAll = (): Record<string, string> => {
    let raw: string;

    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw err;
    }

    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`Upgrade state in ${this.file} is not a JSON object`);
    }

    return parsed as Record<string, string>;
  };

  /** Merge the given key/value pairs into the persisted state. */
  save = (data: Record<string, string>): void => {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ ...this.readAll(), ...data }, null, 2));
  };
}
