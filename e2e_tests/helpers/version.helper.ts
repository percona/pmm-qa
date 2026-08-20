import ServerApi, { PmmVersion } from '@api/server.api';

let cachedVersion: Promise<PmmVersion> | undefined;

// One request per worker process: the promise is cached, so parallel tests share the same
// in-flight call instead of each hitting the server. A failed lookup is not cached, otherwise
// one transient error would fail every gated test in the worker.
export const getServerVersion = (serverApi: ServerApi): Promise<PmmVersion> => {
  cachedVersion ??= serverApi.getPmmVersion().catch((error: unknown) => {
    cachedVersion = undefined;

    throw error;
  });

  return cachedVersion;
};

export const serverVersionBelow = (
  version: { major: number; minor: number; patch: number },
  minVersion: string,
): boolean => {
  const [major, minor, patch] = minVersion.split('.').map(Number);
  if (version.major !== major) return version.major < major;
  if (version.minor !== minor) return version.minor < minor;

  return version.patch < patch;
};
