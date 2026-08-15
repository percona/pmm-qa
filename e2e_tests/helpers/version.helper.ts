export const serverVersionBelow = (minVersion: string): boolean => {
  const match = (process.env.DOCKER_VERSION ?? '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return false;

  const current = match.slice(1).map(Number);
  const min = minVersion.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (current[i] !== min[i]) return current[i] < min[i];
  }

  return false;
};
