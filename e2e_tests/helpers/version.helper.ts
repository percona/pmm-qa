/**
 * PMM Server version gate for e2e tests.
 *
 * Some specs exercise features that exist only from a given PMM Server release. The
 * rc-testing-suite runs the pmm-qa `main` tests against older RC images, so a spec that is
 * ahead of the image under test must skip instead of failing. The server version is read
 * from DOCKER_VERSION (the image under test, e.g. "perconalab/pmm-server:3.9.0-rc"), which the
 * RC and nightly workflows always pass; dev/unknown tags carry no semver and are treated as
 * newest (never skipped).
 */
export const getServerVersion = (): string | null => {
  const match = (process.env.DOCKER_VERSION ?? '').match(/(\d+)\.(\d+)\.(\d+)/);

  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
};

export const serverVersionBelow = (minVersion: string): boolean => {
  const current = getServerVersion();
  if (!current) return false;

  const [a, b, c] = current.split('.').map(Number);
  const [x, y, z] = minVersion.split('.').map(Number);

  if (a !== x) return a < x;
  if (b !== y) return b < y;

  return c < z;
};
