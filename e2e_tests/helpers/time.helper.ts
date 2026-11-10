const durationUnits: Record<string, number> = {
  day: 86_400,
  hour: 3_600,
  minute: 60,
  second: 1,
  week: 604_800,
};

// Grafana's dtdurations text ("3 minutes, 12 seconds") in seconds.
export const grafanaDurationSeconds = (text: string): number =>
  [...text.matchAll(/(\d+)\s+(second|minute|hour|day|week)s?/g)].reduce(
    (sum, [, value, unit]) => sum + Number(value) * durationUnits[unit],
    0,
  );
