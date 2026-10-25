import "server-only";

import { addDays, type Bill } from "@/lib/bill";
import { demoRowToBill } from "@/lib/demo";
import { holdingAll, type HoldingQuery } from "@/lib/hal";
import type { Session } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Where a session's bills come from: live from HAL for real staff, from the
 * demo_bills table for the development account. Both give the same `Bill`,
 * so the bills page and sending don't need to know which.
 */
export async function loadBills(
  session: Session,
  q: Omit<HoldingQuery, "page" | "limit">,
  max = 1000,
): Promise<{ bills: Bill[]; truncated: boolean }> {
  if (!session.demo) return holdingAll(session.token, q, max);

  // Demo parcels are all waiting at the branch, so the status filter is moot.
  const { data, error } = await createAdminClient()
    .from("demo_bills")
    .select("*")
    .eq("branch_id", session.branchId)
    .gte("arrived_at", `${q.startDate}T00:00:00+07:00`)
    .lt("arrived_at", `${addDays(q.endDate, 1)}T00:00:00+07:00`)
    .order("arrived_at", { ascending: false })
    .limit(max + 1);
  if (error) throw new Error(`ອ່ານບິນທົດລອງບໍ່ໄດ້: ${error.message}`);

  return { bills: data.slice(0, max).map(demoRowToBill), truncated: data.length > max };
}

type Loaded = Awaited<ReturnType<typeof loadBills>>;

/** How long the bills page reuses a HAL read. Sending always reads fresh. */
const TTL_MS = 30_000;
const recent = new Map<string, { at: number; result: Promise<Loaded> }>();

/**
 * `loadBills` for the bills page: the same branch and date range within 30 s
 * (a refresh, a search, back after sending) reuse one HAL read, and two loads
 * at once share the request. Demo bills skip it so generated ones show at once.
 */
export function loadBillsForPage(
  session: Session,
  q: Omit<HoldingQuery, "page" | "limit">,
  max = 1000,
): Promise<Loaded> {
  if (session.demo) return loadBills(session, q, max);

  const now = Date.now();
  for (const [k, v] of recent) if (now - v.at > TTL_MS) recent.delete(k);

  const key = JSON.stringify([session.branchId, q.startDate, q.endDate, q.status, max]);
  const hit = recent.get(key);
  if (hit) return hit.result;

  const result = loadBills(session, q, max);
  recent.set(key, { at: now, result });
  // A failed read isn't kept, so the next load tries HAL again.
  result.catch(() => recent.delete(key));
  return result;
}
