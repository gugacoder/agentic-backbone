export interface ActiveHoursConfig {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  timezone?: string;
}

function parseHHMM(str: string): { h: number; m: number } {
  const [h, m] = str.split(":").map(Number);
  return { h, m };
}

function getCurrentMinutes(timezone?: string): number {
  const now = new Date();
  if (!timezone) {
    return now.getHours() * 60 + now.getMinutes();
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  let h = 0;
  let m = 0;
  for (const p of parts) {
    if (p.type === "hour") h = Number(p.value);
    if (p.type === "minute") m = Number(p.value);
  }
  return h * 60 + m;
}

export function isWithinActiveHours(
  config?: ActiveHoursConfig,
  nowMs?: number
): boolean {
  if (!config) return true;

  const { h: sh, m: sm } = parseHHMM(config.start);
  const { h: eh, m: em } = parseHHMM(config.end);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  const currentMin = nowMs !== undefined
    ? Math.floor((nowMs % (24 * 60 * 60 * 1000)) / 60000)
    : getCurrentMinutes(config.timezone);

  if (startMin <= endMin) {
    // Same-day window (e.g., 08:00 → 22:00)
    return currentMin >= startMin && currentMin < endMin;
  } else {
    // Cross-midnight window (e.g., 22:00 → 06:00)
    return currentMin >= startMin || currentMin < endMin;
  }
}
