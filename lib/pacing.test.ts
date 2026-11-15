import assert from "node:assert/strict";
import { test } from "node:test";
import { PACING, batchRest, dailyCap, daysActive, hourlyWait, messageDelay } from "./pacing.ts";

test("message delay stays within 10–40 s", () => {
  assert.equal(messageDelay(() => 0), 10_000);
  assert.equal(messageDelay(() => 1), 40_000);
  assert.equal(messageDelay(() => 0.5), 25_000);
});

test("batch rest stays within 2–5 minutes", () => {
  assert.equal(batchRest(() => 0), 120_000);
  assert.equal(batchRest(() => 1), 300_000);
});

test("a new number ramps up, then the branch limit applies", () => {
  assert.equal(dailyCap(100, 0), 20);
  assert.equal(dailyCap(100, 1), 40);
  assert.equal(dailyCap(100, 2), 80);
  assert.equal(dailyCap(100, 3), 100);
  assert.equal(dailyCap(100, 30), 100);
  // A branch limit lower than the ramp always wins.
  assert.equal(dailyCap(30, 2), 30);
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
  assert.equal(hourlyWait([], now), 0);

  const full = Array.from({ length: PACING.hourlyLimit }, (_, i) => now - (50 - i * 0.5) * min);
  // Oldest was 50 minutes ago: a slot frees in 10 minutes.
  assert.equal(hourlyWait(full, now), 10 * min);

  // Messages older than an hour don't count.
  const old = Array.from({ length: PACING.hourlyLimit }, () => now - 61 * min);
  assert.equal(hourlyWait(old, now), 0);

  // One under the limit still sends.
  assert.equal(hourlyWait(full.slice(1), now), 0);
});
