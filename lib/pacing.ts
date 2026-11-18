/**
 * How fast WhatsApp messages go out. A number that sends in a steady, quick
 * rhythm, or suddenly a lot, is what gets banned, so sending is slowed on
 * purpose. Each branch can change its own pace within BOUNDS; everything here
 * is a pure function, so it is tested without a gateway.
 */

export type PacingConfig = {
  /** Random gap between two messages, seconds. */
  delayMin: number;
  delayMax: number;
  /** A longer rest after this many messages in a row ... */
  batchSize: number;
  /** ... of a random length in this range, minutes. */
  restMin: number;
  restMax: number;
  /** At most this many messages in any rolling hour, per WhatsApp number. */
  hourlyLimit: number;
  /** At most this many messages per day, per branch. */
  dailyLimit: number;
  /** A number new to the app starts low: see RAMP_UP. */
  rampUp: boolean;
};

export type PresetKey = "safe" | "standard" | "fast";

export const PRESETS: Record<PresetKey, PacingConfig> = {
  safe: { delayMin: 20, delayMax: 60, batchSize: 15, restMin: 3, restMax: 8, hourlyLimit: 30, dailyLimit: 60, rampUp: true },
  standard: { delayMin: 10, delayMax: 40, batchSize: 20, restMin: 2, restMax: 5, hourlyLimit: 40, dailyLimit: 100, rampUp: true },
  fast: { delayMin: 6, delayMax: 20, batchSize: 30, restMin: 1, restMax: 3, hourlyLimit: 80, dailyLimit: 200, rampUp: true },
};

export const DEFAULT_PACING = PRESETS.standard;

/** Limits no setting can go past, so nobody can switch the protection off. */
export const BOUNDS = {
  delayMin: [5, 180],
  delayMax: [5, 180],
  batchSize: [5, 50],
  restMin: [0.5, 15],
  restMax: [0.5, 15],
  hourlyLimit: [5, 120],
  dailyLimit: [10, 300],
} as const satisfies Record<string, readonly [number, number]>;

/** A number new to the app: the daily cap on its 1st, 2nd, 3rd day. */
export const RAMP_UP = [20, 40, 80] as const;

/** After repeated failures: wait this long once before trying again, ms. */
export const COOL_DOWN_MS = 20 * 60_000;

const HOUR_MS = 3_600_000;

const NUMBER_KEYS = ["delayMin", "delayMax", "batchSize", "restMin", "restMax", "hourlyLimit", "dailyLimit"] as const;

const LABELS: Record<(typeof NUMBER_KEYS)[number], string> = {
  delayMin: "ຫ່າງຕ່ຳສຸດ (ວິນາທີ)",
  delayMax: "ຫ່າງສູງສຸດ (ວິນາທີ)",
  batchSize: "ພັກທຸກໆ (ຂໍ້ຄວາມ)",
  restMin: "ພັກຕ່ຳສຸດ (ນາທີ)",
  restMax: "ພັກສູງສຸດ (ນາທີ)",
  hourlyLimit: "ສູງສຸດຕໍ່ຊົ່ວໂມງ",
  dailyLimit: "ສູງສຸດຕໍ່ວັນ",
};

/** Whole numbers, except the rest, which may be half a minute. */
const WHOLE = new Set<string>(["delayMin", "delayMax", "batchSize", "hourlyLimit", "dailyLimit"]);

export type ParsedPacing = { ok: true; value: PacingConfig } | { ok: false; error: string };

/** Checks user input against BOUNDS; the error says which field and the allowed range. */
export function parsePacing(input: Record<string, unknown>): ParsedPacing {
  const out: Record<string, number> = {};
  for (const key of NUMBER_KEYS) {
    const raw = input[key];
    const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
    const [min, max] = BOUNDS[key];
    if (String(raw ?? "").trim() === "" || !Number.isFinite(n) || (WHOLE.has(key) && !Number.isInteger(n))) {
      return { ok: false, error: `${LABELS[key]}: ໃສ່ຕົວເລກ${WHOLE.has(key) ? "ເຕັມ" : ""}` };
    }
    if (n < min || n > max) return { ok: false, error: `${LABELS[key]}: ໃສ່ໄດ້ ${min}–${max}` };
    out[key] = n;
  }
  if (out.delayMax! < out.delayMin!) return { ok: false, error: "ຫ່າງສູງສຸດ ຕ້ອງບໍ່ໜ້ອຍກວ່າ ຫ່າງຕ່ຳສຸດ" };
  if (out.restMax! < out.restMin!) return { ok: false, error: "ພັກສູງສຸດ ຕ້ອງບໍ່ໜ້ອຍກວ່າ ພັກຕ່ຳສຸດ" };

  const rampUp = input.rampUp === true || input.rampUp === "on" || input.rampUp === "true";
  return { ok: true, value: { ...(out as Omit<PacingConfig, "rampUp">), rampUp } };
}

/** The part saved in `branches.pacing`; the daily limit has its own column. */
export function storedPacing(c: PacingConfig): Omit<PacingConfig, "dailyLimit"> {
  const { delayMin, delayMax, batchSize, restMin, restMax, hourlyLimit, rampUp } = c;
  return { delayMin, delayMax, batchSize, restMin, restMax, hourlyLimit, rampUp };
}

/**
 * The pace a branch really uses: what it saved if that is still valid,
 * otherwise the standard one. Never throws, so a bad row can't stop sending.
 */
export function resolvePacing(stored: unknown, dailyLimit: number): PacingConfig {
  const base = { ...DEFAULT_PACING, dailyLimit };
  if (!stored || typeof stored !== "object") return clampDaily(base);
  const parsed = parsePacing({ ...DEFAULT_PACING, ...(stored as object), dailyLimit });
  return parsed.ok ? parsed.value : clampDaily(base);
}

function clampDaily(c: PacingConfig): PacingConfig {
  const [min, max] = BOUNDS.dailyLimit;
  return { ...c, dailyLimit: Math.min(max, Math.max(min, c.dailyLimit)) };
}

/** Which preset these numbers are, or "custom". */
export function presetOf(c: PacingConfig): PresetKey | "custom" {
  const same = (p: PacingConfig) => NUMBER_KEYS.every((k) => p[k] === c[k]) && p.rampUp === c.rampUp;
  return (Object.keys(PRESETS) as PresetKey[]).find((k) => same(PRESETS[k])) ?? "custom";
}

/** Faster or bigger than the standard pace anywhere: the page warns about it. */
export function isRisky(c: PacingConfig): boolean {
  const s = DEFAULT_PACING;
  return (
    c.delayMin < s.delayMin ||
    c.delayMax < s.delayMax ||
    c.batchSize > s.batchSize ||
    c.hourlyLimit > s.hourlyLimit ||
    c.dailyLimit > s.dailyLimit ||
    !c.rampUp
  );
}

/** A random whole number of ms in [min, max]. */
function between(min: number, max: number, rand: () => number): number {
  return Math.round(min + rand() * (max - min));
}

/** Pause before the next message, ms. */
export const messageDelay = (c: PacingConfig, rand = Math.random) =>
  between(c.delayMin * 1000, c.delayMax * 1000, rand);

/** Pause after a full batch, ms. */
export const batchRest = (c: PacingConfig, rand = Math.random) =>
  between(c.restMin * 60_000, c.restMax * 60_000, rand);

/**
 * The most a branch may send today: the ramp-up while its number is new (if
 * switched on), then the branch's own daily limit. `days` is 0 on the first day of use.
 */
export function dailyCap(c: PacingConfig, days: number): number {
  const ramp = c.rampUp ? RAMP_UP[Math.max(0, days)] : undefined;
  return ramp === undefined ? c.dailyLimit : Math.min(c.dailyLimit, ramp);
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
export function hourlyWait(sentAt: number[], now: number, limit: number): number {
  const recent = sentAt.filter((t) => t > now - HOUR_MS).sort((a, b) => a - b);
  if (recent.length < limit) return 0;
  // The slot frees when enough of the oldest messages have left the hour.
  return Math.max(0, recent[recent.length - limit]! + HOUR_MS - now);
}

/** About how long `count` messages take, in minutes, for the settings page. */
export function estimateMinutes(count: number, c: PacingConfig): number {
  if (count <= 0) return 0;
  const gaps = ((c.delayMin + c.delayMax) / 2 / 60) * (count - 1);
  const rests = Math.floor((count - 1) / c.batchSize) * ((c.restMin + c.restMax) / 2);
  // The hourly limit sets a floor: each further `hourlyLimit` messages needs another hour.
  const hourly = (Math.ceil(count / c.hourlyLimit) - 1) * 60;
  return Math.ceil(Math.max(gaps + rests, hourly));
}
