import { withSupabase } from "npm:@supabase/server@1.9.1";

import type { Database } from "../_shared/db.ts";
import { fail, isResponse, json, readJson, requireRole } from "../_shared/http.ts";

type ShipmentInsert = Database["public"]["Tables"]["shipments"]["Insert"];
type BranchInsert = Database["public"]["Tables"]["branches"]["Insert"];

/** One record of the HAL API, kept loose: only the fields `toRow` reads matter. */
type HalShipment = {
  id?: unknown;
  shipment_number?: unknown;
  shipment_type?: string | null;
  shipment_pay_type?: string | null;
  shipment_status_id?: unknown;
  step?: string | null;
  name?: string | null;
  pieces?: unknown;
  total_freight?: unknown;
  total_price?: unknown;
  sender_customer_id?: unknown;
  sender_customer?: HalCustomer | null;
  receiver_customer_id?: unknown;
  receiver_customer?: HalCustomer | null;
  start_branch_id?: unknown;
  end_branch_id?: unknown;
  start_date_actual?: unknown;
  end_date_actual?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  parcel?: { weight?: unknown; dimension_length?: unknown } | null;
  label_status?: { status?: string | null } | null;
  start_branch?: HalBranch | null;
  end_branch?: HalBranch | null;
  [key: string]: unknown;
};

type HalCustomer = { name?: string | null; surname?: string | null; tel?: string | null };

type HalBranch = {
  id?: unknown;
  name?: string | null;
  code?: string | null;
  tel?: string | null;
  village?: { district?: { name?: string | null } | null } | null;
  province?: { name?: string | null } | null;
};

/** Accepts the HAL API page as-is (`{ data: [...] }`) or a bare array. */
type Body = { data?: HalShipment[] } | HalShipment[];

/**
 * HAL writes `start_date_*` / `end_date_*` as Laos local time with no offset
 * ("2026-08-27 09:45:14"); `created_at` / `updated_at` are proper ISO UTC.
 */
function laosTime(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(v.trim());
  return m ? `${m[1]}T${m[2]}+07:00` : v;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function fullName(c: HalCustomer | null | undefined): string | null {
  if (!c) return null;
  const name = [c.name, c.surname].filter(Boolean).join(" ").trim();
  return name || null;
}

/** Only the HAL identity of a branch; staff settings are never overwritten. */
function toBranch(b: HalBranch | null | undefined): BranchInsert | null {
  const id = num(b?.id);
  if (!b || id === null || !b.name) return null;
  return {
    id,
    name: b.name,
    code: b.code ?? null,
    tel: b.tel ?? null,
    district: b.village?.district?.name ?? null,
    province: b.province?.name ?? null,
  };
}

function toRow(s: HalShipment, importedBy: string): ShipmentInsert | null {
  const id = num(s.id);
  if (id === null || typeof s.shipment_number !== "string") return null;

  // HAL has already delivered these: they must never be announced as arrived.
  const delivered = s.label_status?.status === "delivered" || s.step === "success";
  const cod = s.shipment_pay_type?.endsWith("_cod") ? num(s.total_price) : null;

  return {
    id,
    shipment_number: s.shipment_number,
    shipment_type: s.shipment_type ?? null,
    shipment_pay_type: s.shipment_pay_type ?? null,
    shipment_status_id: num(s.shipment_status_id),
    status_step: s.step ?? null,
    status_name: s.name ?? null,
    pieces: num(s.pieces),
    total_freight: num(s.total_freight),
    total_price: num(s.total_price),
    sender_customer_id: num(s.sender_customer_id),
    sender_name: fullName(s.sender_customer),
    receiver_customer_id: num(s.receiver_customer_id),
    receiver_name: fullName(s.receiver_customer),
    start_branch_id: num(s.start_branch_id),
    end_branch_id: num(s.end_branch_id),
    start_date_actual: laosTime(s.start_date_actual),
    end_date_actual: laosTime(s.end_date_actual),
    hal_created_at: s.created_at ?? null,
    hal_updated_at: s.updated_at ?? null,
    receiver_phone: s.receiver_customer?.tel ?? null,
    weight_kg: num(s.parcel?.weight),
    size_cm: num(s.parcel?.dimension_length),
    cod_amount: cod,
    parcel_status: delivered ? "delivered" : "in_transit",
    raw: s,
    imported_by: importedBy,
    imported_at: new Date().toISOString(),
  };
}

/**
 * Upserts a page of HAL shipments. Admin only.
 *
 * Runs as the caller (RLS-scoped client) — the `shipments_admin_write` policy
 * is what actually permits the write; the role check just gives a clean error.
 */
const importShipments = {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (req: Request, ctx): Promise<Response> => {
      if (req.method !== "POST") return fail("Use POST", 405);

      const caller = await requireRole(ctx, "admin");
      if (isResponse(caller)) return caller;

      const body = await readJson<Body>(req);
      const items = Array.isArray(body) ? body : body?.data;
      if (!Array.isArray(items) || items.length === 0) {
        return fail("Expected the HAL API response ({ data: [...] }) or an array");
      }
      if (items.length > 1000) return fail("At most 1000 shipments per call");

      const rows: ShipmentInsert[] = [];
      const skipped: number[] = [];
      items.forEach((s, i) => {
        const row = toRow(s, caller.id);
        if (row) rows.push(row);
        else skipped.push(i);
      });

      const branches = new Map<number, BranchInsert>();
      for (const s of items) {
        for (const b of [toBranch(s.start_branch), toBranch(s.end_branch)]) {
          if (b) branches.set(b.id, b);
        }
      }
      if (branches.size > 0) {
        const { error } = await ctx.supabase
          .from("branches")
          .upsert([...branches.values()], { onConflict: "id" });
        if (error) return fail(`Saving branches failed: ${error.message}`, 500);
      }

      if (rows.length > 0) {
        const { error } = await ctx.supabase
          .from("shipments")
          .upsert(rows, { onConflict: "id" });
        if (error) return fail(`Saving shipments failed: ${error.message}`, 500);
      }

      return json({ imported: rows.length, branches: branches.size, skipped });
    },
  ),
};

export default importShipments;
