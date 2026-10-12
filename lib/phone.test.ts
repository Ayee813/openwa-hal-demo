// Run with: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatLaoPhone, toChatId, toLaoMsisdn } from "./phone.ts";

test("HAL's 8-digit mobile numbers get the 20 prefix", () => {
  assert.equal(toLaoMsisdn("97364057"), "8562097364057");
  assert.equal(toChatId(toLaoMsisdn("95113546")!), "8562095113546@c.us");
});

test("local, international and spaced forms are the same number", () => {
  for (const raw of [
    "02078331163",
    "2078331163",
    "8562078331163",
    "+856 20 7833 1163",
    "00856 20 78331163",
  ]) {
    assert.equal(toLaoMsisdn(raw), "8562078331163", raw);
  }
});

test("030 numbers", () => {
  assert.equal(toLaoMsisdn("0305123456"), "856305123456");
});

test("masked, empty and malformed numbers are rejected", () => {
  for (const raw of ["020****5048", "", null, undefined, "1234", "0219999999999"]) {
    assert.equal(toLaoMsisdn(raw), null, String(raw));
  }
});

test("formatting for staff", () => {
  assert.equal(formatLaoPhone("97364057"), "020 9736 4057");
  assert.equal(formatLaoPhone("bad"), "bad");
});
