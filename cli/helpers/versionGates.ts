// Specs keyed by their PMM-T id skip when the pmm-client under test is below this version.
export const minPmmClientVersion: Record<string, string> = {
  'PMM-T2129': '3.10.0',
  'PMM-T2325': '3.10.0',
  'PMM-T2326': '3.10.0',
  'PMM-T2307': '3.7.0',
  'PMM-T2308': '3.7.0',
  'PMM-T2310': '3.7.0',
  'PMM-T2426': '3.7.0',
  'PMM-T2427': '3.7.0',
  'PMM-T2428': '3.7.0',
  'PMM-T2429': '3.7.0',
  'PMM-T2430': '3.7.0',
  'PMM-T2431': '3.7.0',
  'PMM-T2432': '3.7.0',
  'PMM-T2433': '3.7.0',
  'PMM-T2434': '3.7.0',
  'PMM-T2437': '3.7.0',
  'PMM-T2438': '3.7.0',
  'PMM-T2449': '3.7.0',
  'PMM-T2450': '3.7.0',
  'PMM-T2451': '3.7.0',
  'PMM-T2453': '3.7.0',
  'PMM-T2454': '3.7.0',
  'PMM-T2455': '3.7.0',
  'PMM-T2456': '3.7.0',
  'PMM-T2457': '3.7.0',
  'PMM-T2458': '3.7.0',
  'PMM-T2459': '3.7.0',
  'PMM-T2460': '3.7.0',
  'PMM-T2309': '3.9.0',
  'PMM-T2435': '3.9.0',
  'PMM-T2436': '3.9.0',
  'PMM-T2452': '3.10.0',
};

export const versionBelow = (version: string, minVersion: string): boolean => {
  const [major, minor, patch] = version.split('.').map(Number);
  const [minMajor, minMinor, minPatch] = minVersion.split('.').map(Number);
  if (major !== minMajor) return major < minMajor;
  if (minor !== minMinor) return minor < minMinor;

  return patch < minPatch;
};
