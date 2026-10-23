// Run with: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_BRANCH_ID, demoRowToBill, generateDemoBills } from "./demo.ts";
import { phoneProblem } from "./phone.ts";

test("generateDemoBills uses the given numbers in turn", () => {
  const rows = generateDemoBills({
    count: 4,
    phones: ["02011111111", "02022222222"],
    date: "2026-10-24",
    includeBad: false,
  });
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.receiver_phone), [
    "02011111111",
    "02022222222",
    "02011111111",
    "02022222222",
  ]);
  for (const r of rows) {
    assert.equal(r.branch_id, DEMO_BRANCH_ID);
    assert.match(r.bill_number, /^DEV261024\d{6}$/);
    assert.equal(phoneProblem(r.receiver_phone), null);
    // 08:00–17:59 Laos time is the same calendar day in UTC.
    assert.equal(r.arrived_at.slice(0, 10), "2026-10-24");
    assert.equal(r.cod_amount !== null, r.pay_type.endsWith("_cod"));
  }
});

test("includeBad puts every fifth bill in the cannot-send tab", () => {
  const rows = generateDemoBills({ count: 10, phones: ["02011111111"], date: "2026-10-24", includeBad: true });
  const bad = rows
    .map((r) => demoRowToBill({ ...r, id: 1, created_at: "" }))
    .flatMap((b, i) => (phoneProblem(b.receiverPhone) ? [i] : []));
  assert.deepEqual(bad, [4, 9]);
});
