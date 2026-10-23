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
