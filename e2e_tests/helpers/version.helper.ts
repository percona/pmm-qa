export const serverVersionBelow = (
  version: { major: number; minor: number; patch: number },
  minVersion: string,
): boolean => {
  const [major, minor, patch] = minVersion.split('.').map(Number);
  if (version.major !== major) return version.major < major;
  if (version.minor !== minor) return version.minor < minor;

  return version.patch < patch;
};
