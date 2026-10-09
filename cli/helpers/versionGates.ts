// Specs keyed by their PMM-T id skip when the pmm-client under test is below this version.
export const minPmmClientVersion: Record<string, string> = {
  'PMM-T2129': '3.10.0',
  'PMM-T2325': '3.10.0',
  'PMM-T2326': '3.10.0',
};

export const versionBelow = (version: string, minVersion: string): boolean => {
  const [major, minor, patch] = version.split('.').map(Number);
  const [minMajor, minMinor, minPatch] = minVersion.split('.').map(Number);
  if (major !== minMajor) return major < minMajor;
  if (minor !== minMinor) return minor < minMinor;

  return patch < minPatch;
};
