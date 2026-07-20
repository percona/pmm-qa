export type SemVer = {
  major: number;
  minor: number;
  patch: number;
};

export const parseSemVer = (version: string): SemVer | null => {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

export const parseClientVersion = (version = process.env.CLIENT_VERSION): SemVer | null => {
  const raw = (version ?? '').trim();
  if (!raw) {
    return null;
  }

  return parseSemVer(raw);
};

export const compareSemVer = (left: SemVer, right: SemVer): number => {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  return left.patch - right.patch;
};

export const isClientVersionAtLeast = (minimum: string, version = process.env.CLIENT_VERSION): boolean => {
  const current = parseClientVersion(version);
  const min = parseSemVer(minimum);

  // RC, dev-latest, and tarball installs should run feature-gated tests.
  if (!current || !min) {
    return true;
  }

  return compareSemVer(current, min) >= 0;
};
