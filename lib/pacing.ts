/**
 * How fast WhatsApp messages go out. A number that sends in a steady, quick
 * rhythm, or suddenly a lot, is what gets banned, so sending is slowed on
 * purpose. Everything here is a pure function, so it is tested without a gateway.
 */

export const PACING = {
  /** Random gap between two messages, ms. */
  delayMs: [10_000, 40_000],
  /** A longer rest after this many messages in a row ... */
  batchSize: 20,
  /** ... of a random length in this range, ms. */
  restMs: [2 * 60_000, 5 * 60_000],
  /** At most this many messages in any rolling hour, per WhatsApp number. */
  hourlyLimit: 40,
  /** A number new to the app: the daily cap on its 1st, 2nd, 3rd day. */
  rampUp: [20, 40, 80],
  /** After repeated failures: wait this long once before trying again, ms. */
  coolDownMs: 20 * 60_000,
} as const;

const HOUR_MS = 3_600_000;

/** A random whole number of ms in [min, max]. */
export function between(range: readonly [number, number] | readonly number[], rand = Math.random): number {
  const [min, max] = range as [number, number];
  return Math.round(min + rand() * (max - min));
}

/** Pause before the next message. */
export const messageDelay = (rand = Math.random) => between(PACING.delayMs, rand);

/** Pause after a full batch. */
export const batchRest = (rand = Math.random) => between(PACING.restMs, rand);

/**
 * The most a branch may send today: the ramp-up while its number is new, then
 * the branch's own `daily_limit`. `daysActive` is 0 on the first day of use.
 */
export function dailyCap(dailyLimit: number, daysActive: number): number {
  const ramp = PACING.rampUp[Math.max(0, daysActive)];
  return ramp === undefined ? dailyLimit : Math.min(dailyLimit, ramp);
}

/** Whole days between the first message and today (0 = the first day). */
export function daysActive(firstAt: number | null, todayStart: number): number {
  if (firstAt === null) return 0;
  return Math.max(0, Math.floor((todayStart - firstAt) / 86_400_000) + 1);
}

/**
 * Ms to wait before one more message fits in the rolling hour; 0 when it does
 * now. `sentAt` holds the send times (ms) of the messages already sent.
 */
export function hourlyWait(sentAt: number[], now: number, limit: number = PACING.hourlyLimit): number {
  const recent = sentAt.filter((t) => t > now - HOUR_MS).sort((a, b) => a - b);
  if (recent.length < limit) return 0;
  // The slot frees when enough of the oldest messages have left the hour.
  return Math.max(0, recent[recent.length - limit]! + HOUR_MS - now);
}
