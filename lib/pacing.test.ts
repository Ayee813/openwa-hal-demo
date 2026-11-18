import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOUNDS,
  DEFAULT_PACING,
  PRESETS,
  batchRest,
  dailyCap,
  daysActive,
  estimateMinutes,
  hourlyWait,
  isRisky,
  messageDelay,
  parsePacing,
  presetOf,
  resolvePacing,
  storedPacing,
  type PacingConfig,
} from "./pacing.ts";

const std = DEFAULT_PACING;

test("message delay stays within the configured seconds", () => {
  assert.equal(messageDelay(std, () => 0), 10_000);
  assert.equal(messageDelay(std, () => 1), 40_000);
  assert.equal(messageDelay(std, () => 0.5), 25_000);
  assert.equal(messageDelay(PRESETS.safe, () => 1), 60_000);
});

test("batch rest stays within the configured minutes", () => {
  assert.equal(batchRest(std, () => 0), 120_000);
  assert.equal(batchRest(std, () => 1), 300_000);
});

test("a new number ramps up, then the branch limit applies", () => {
  assert.equal(dailyCap(std, 0), 20);
  assert.equal(dailyCap(std, 1), 40);
  assert.equal(dailyCap(std, 2), 80);
  assert.equal(dailyCap(std, 3), 100);
  assert.equal(dailyCap(std, 30), 100);
  // A branch limit lower than the ramp always wins.
  assert.equal(dailyCap({ ...std, dailyLimit: 30 }, 2), 30);
  // With the ramp-up switched off the limit applies from day one.
  assert.equal(dailyCap({ ...std, rampUp: false }, 0), 100);
});

test("days active counts calendar days from the first message", () => {
  const today = Date.parse("2026-11-15T00:00:00+07:00");
  assert.equal(daysActive(null, today), 0);
  assert.equal(daysActive(Date.parse("2026-11-15T09:00:00+07:00"), today), 0);
  assert.equal(daysActive(Date.parse("2026-11-14T23:00:00+07:00"), today), 1);
  assert.equal(daysActive(Date.parse("2026-11-12T10:00:00+07:00"), today), 3);
});

test("hourly limit waits until the oldest message leaves the hour", () => {
  const now = Date.parse("2026-11-15T12:00:00+07:00");
  const min = 60_000;
  const limit = std.hourlyLimit;
  assert.equal(hourlyWait([], now, limit), 0);

  const full = Array.from({ length: limit }, (_, i) => now - (50 - i * 0.5) * min);
  // Oldest was 50 minutes ago: a slot frees in 10 minutes.
  assert.equal(hourlyWait(full, now, limit), 10 * min);

  // Messages older than an hour don't count.
  const old = Array.from({ length: limit }, () => now - 61 * min);
  assert.equal(hourlyWait(old, now, limit), 0);

  // One under the limit still sends.
  assert.equal(hourlyWait(full.slice(1), now, limit), 0);
  // A different limit moves the line.
  assert.equal(hourlyWait(full, now, limit + 1), 0);
});

test("every preset is valid and is recognised as itself", () => {
  for (const [key, preset] of Object.entries(PRESETS)) {
    const parsed = parsePacing({ ...preset });
    assert.equal(parsed.ok, true, key);
    assert.equal(presetOf(preset), key);
  }
  assert.equal(presetOf({ ...std, hourlyLimit: 41 }), "custom");
});

test("parsePacing accepts form strings and a checkbox", () => {
  const form = Object.fromEntries(Object.entries(std).map(([k, v]) => [k, String(v)]));
  const parsed = parsePacing({ ...form, rampUp: "on" });
  assert.deepEqual(parsed, { ok: true, value: std });
  // An unchecked box isn't sent at all.
  const off = parsePacing({ ...form, rampUp: undefined });
  assert.equal(off.ok && off.value.rampUp, false);
});

test("parsePacing refuses values outside the bounds", () => {
  const bad = (patch: Partial<Record<keyof PacingConfig, unknown>>) => parsePacing({ ...std, ...patch });
  assert.equal(bad({ delayMin: 1 }).ok, false); // 1 s would defeat the point
  assert.equal(bad({ delayMin: BOUNDS.delayMin[0] - 1 }).ok, false);
  assert.equal(bad({ delayMax: 500 }).ok, false);
  assert.equal(bad({ batchSize: 4 }).ok, false);
  assert.equal(bad({ restMin: 0 }).ok, false);
  assert.equal(bad({ hourlyLimit: 500 }).ok, false);
  assert.equal(bad({ dailyLimit: 5000 }).ok, false);
  assert.equal(bad({ delayMin: "" }).ok, false);
  assert.equal(bad({ delayMin: "abc" }).ok, false);
  assert.equal(bad({ batchSize: 12.5 }).ok, false);
  // Half a minute of rest is fine.
  assert.equal(bad({ restMin: 0.5, restMax: 1 }).ok, true);
});

test("parsePacing needs max not below min", () => {
  assert.equal(parsePacing({ ...std, delayMin: 30, delayMax: 20 }).ok, false);
  assert.equal(parsePacing({ ...std, restMin: 5, restMax: 2 }).ok, false);
  assert.equal(parsePacing({ ...std, delayMin: 20, delayMax: 20 }).ok, true);
});

test("resolvePacing falls back to standard for missing or broken data", () => {
  assert.deepEqual(resolvePacing(null, 100), std);
  assert.deepEqual(resolvePacing("nonsense", 100), std);
  assert.deepEqual(resolvePacing({ delayMin: 1 }, 100), std); // out of bounds: ignored
  // The branch's daily_limit column always wins for the daily cap.
  assert.equal(resolvePacing(null, 60).dailyLimit, 60);
  // Old rows with the old 200 default are still inside the bounds.
  assert.equal(resolvePacing(null, 200).dailyLimit, 200);
  // A saved pace is used, and a partial one is topped up with the standard values.
  const saved = resolvePacing(storedPacing(PRESETS.safe), 60);
  assert.deepEqual(saved, PRESETS.safe);
  assert.equal(resolvePacing({ delayMin: 15, delayMax: 30 }, 100).batchSize, std.batchSize);
});

test("storedPacing leaves the daily limit to its own column", () => {
  assert.equal("dailyLimit" in storedPacing(std), false);
});

test("riskier than standard is flagged", () => {
  assert.equal(isRisky(PRESETS.standard), false);
  assert.equal(isRisky(PRESETS.safe), false);
  assert.equal(isRisky(PRESETS.fast), true);
  assert.equal(isRisky({ ...std, rampUp: false }), true);
  assert.equal(isRisky({ ...std, delayMin: 9 }), true);
});

test("estimate: gaps and rests, with the hourly limit as a floor", () => {
  assert.equal(estimateMinutes(0, std), 0);
  // 100 messages: 99 gaps of 25 s = 41.25 min, 4 rests of 3.5 min = 14 min -> 56 min.
  // The hourly limit of 40 needs (3 - 1) hours = 120 min, which is longer.
  assert.equal(estimateMinutes(100, std), 120);
  // 20 messages: 19 gaps of 25 s = 7.9 min, no rest, under the hourly limit.
  assert.equal(estimateMinutes(20, std), 8);
  // A faster hourly limit leaves the gaps and rests as the limit.
  assert.equal(estimateMinutes(100, { ...std, hourlyLimit: 120 }), 56);
});
