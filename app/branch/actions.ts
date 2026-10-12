"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBranch } from "@/lib/auth";
import { laosDatePlus } from "@/lib/message";
import { queueMessages, syncStatuses, type QueueResult } from "@/lib/notify";
import { OpenWAError, branchSessionName, openwa, type SessionStatus } from "@/lib/openwa";
import { toLaoMsisdn } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import type { MessageKind, Shipment } from "@/lib/types";

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

const ids = z.array(z.number().int().positive()).min(1).max(100);

export async function sendBills(
  shipmentIds: number[],
  kind: MessageKind,
): Promise<QueueResult> {
  const parsed = ids.safeParse(shipmentIds);
  if (!parsed.success) return { queued: 0, skipped: [], error: "ເລືອກໄດ້ 1–100 ບິນຕໍ່ຄັ້ງ" };

  const { profile, branch } = await requireBranch();
  const supabase = await createClient();
  const result = await queueMessages(
    supabase,
    profile,
    branch,
    parsed.data,
    kind === "reminder" ? "reminder" : "arrival",
  );

  revalidatePath("/branch");
  return result;
}

/** Polled by the bills page while messages are in flight. */
export async function refreshStatuses(): Promise<number> {
  const { branch } = await requireBranch();
  const supabase = await createClient();
  const changed = await syncStatuses(supabase, branch);
  if (changed) revalidatePath("/branch");
  return changed;
}

/**
 * Receives bills into the branch from the list, same as scanning each one:
 * in_transit → arrived with a pickup deadline, then notifies if auto-send is on.
 */
export async function receiveBills(
  shipmentIds: number[],
): Promise<{ received: number; sent?: QueueResult; error?: string }> {
  const parsed = ids.safeParse(shipmentIds);
  if (!parsed.success) return { received: 0, error: "ເລືອກໄດ້ 1–100 ບິນຕໍ່ຄັ້ງ" };

  const { profile, branch } = await requireBranch();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .update({
      parcel_status: "arrived",
      arrived_at: new Date().toISOString(),
      scanned_by: profile.id,
      pickup_deadline: laosDatePlus(branch.pickup_days),
    })
    .in("id", parsed.data)
    .eq("end_branch_id", branch.id)
    .eq("parcel_status", "in_transit")
    .select("id");
  if (error) return { received: 0, error: error.message };

  const received = data.map((r) => r.id);
  const sent =
    branch.auto_send && received.length
      ? await queueMessages(supabase, profile, branch, received, "arrival")
      : undefined;

  revalidatePath("/branch");
  return { received: received.length, sent };
}

export async function markPickedUp(shipmentIds: number[]): Promise<{ error?: string }> {
  const parsed = ids.safeParse(shipmentIds);
  if (!parsed.success) return { error: "ເລືອກບິນກ່ອນ" };

  const { branch } = await requireBranch();
  const supabase = await createClient();
  const { error } = await supabase
    .from("shipments")
    .update({ parcel_status: "picked_up", picked_up_at: new Date().toISOString() })
    .in("id", parsed.data)
    .eq("end_branch_id", branch.id)
    .in("parcel_status", ["arrived", "notified"]);

  revalidatePath("/branch");
  return error ? { error: error.message } : {};
}

// ---------------------------------------------------------------------------
// Scanning parcels into the branch
// ---------------------------------------------------------------------------

export type ScanResult = {
  outcome: "arrived" | "duplicate" | "done" | "not_found" | "empty" | "error";
  message: string;
  shipment?: Pick<Shipment, "id" | "shipment_number" | "receiver_name" | "receiver_phone">;
  sent?: QueueResult;
};

/** `number` from the camera / keyboard, or `simulate` to take the next parcel due. */
export async function scanShipment(input: {
  number?: string;
  simulate?: boolean;
}): Promise<ScanResult> {
  const { profile, branch } = await requireBranch();
  const supabase = await createClient();

  const fields =
    "id, shipment_number, receiver_name, receiver_phone, parcel_status";
  let query = supabase
    .from("shipments")
    .select(fields)
    .eq("end_branch_id", branch.id);

  if (input.simulate) {
    query = query
      .eq("parcel_status", "in_transit")
      .order("hal_created_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });
  } else {
    const number = (input.number ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9-]{6,40}$/.test(number)) {
      return { outcome: "error", message: "ເລກບິນບໍ່ຖືກຕ້ອງ" };
    }
    query = query.eq("shipment_number", number);
  }

  const { data: found, error } = await query.limit(1).maybeSingle();
  if (error) return { outcome: "error", message: error.message };
  if (!found) {
    return input.simulate
      ? { outcome: "empty", message: "ບໍ່ມີບິນກຳລັງມາສາຂານີ້. ກົດ Generate ບິນກ່ອນ" }
      : { outcome: "not_found", message: `ບໍ່ພົບບິນ ${input.number} ໃນລາຍການຂອງສາຂານີ້` };
  }

  const shipment = {
    id: found.id,
    shipment_number: found.shipment_number,
    receiver_name: found.receiver_name,
    receiver_phone: found.receiver_phone,
  };

  if (found.parcel_status === "arrived" || found.parcel_status === "notified") {
    return { outcome: "duplicate", message: "ບິນນີ້ສະແກນເຂົ້າສາຂາແລ້ວ", shipment };
  }
  if (found.parcel_status !== "in_transit") {
    return { outcome: "done", message: "ບິນນີ້ຮັບເຄື່ອງ ຫຼື ຈັດສົ່ງສຳເລັດແລ້ວ", shipment };
  }

  const { error: updateError } = await supabase
    .from("shipments")
    .update({
      parcel_status: "arrived",
      arrived_at: new Date().toISOString(),
      scanned_by: profile.id,
      pickup_deadline: laosDatePlus(branch.pickup_days),
    })
    .eq("id", found.id);
  if (updateError) return { outcome: "error", message: updateError.message, shipment };

  const sent = branch.auto_send
    ? await queueMessages(supabase, profile, branch, [found.id], "arrival")
    : undefined;

  revalidatePath("/branch");
  return { outcome: "arrived", message: "ຮັບເຂົ້າສາຂາແລ້ວ", shipment, sent };
}

// ---------------------------------------------------------------------------
// Demo bills
// ---------------------------------------------------------------------------

const FIRST = ["ສົມສັກ", "ບຸນມີ", "ຄຳພອນ", "ນາງ ແສງດາວ", "ນາງ ມະນີວອນ", "ທ້າວ ອານຸສອນ", "ນາງ ພອນສະຫວັນ", "ສີສຸກ", "ນາງ ວັນນາ", "ທ້າວ ໄຊຍະວົງ"];
const LAST = ["ພົມມະຈັນ", "ສີສຸວັນ", "ແກ້ວມະນີ", "ວົງສະຫວັນ", "ອິນທະວົງ", "ສຸລິຍະ", "ຈັນທະລາ", "ແສງສົມບັດ"];
const ORIGINS = ["ໂພນປາເປົ້າ", "ທາດຫຼວງ", "ຄຳຮຸ່ງ(ຮຮ ທະນາຄານ)", "ໂພນທັນ3 (ຫນ້າໄອເຕັກ)", "ໜອງຄາຍ", "DP_HT Shop"];
const CATEGORIES = ["ເສື້ອຜ້າ", "ອາຫານ", "ເຄື່ອງໃຊ້ໄຟຟ້າ", "ເອກະສານ", "ເຄື່ອງສຳອາງ", "ອາໄຫຼ່ລົດ"];

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

export type GenerateState = { ok?: string; error?: string };

export async function generateBills(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const { profile, branch } = await requireBranch();

  const count = Number(formData.get("count"));
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    return { error: "ຈຳນວນຕ້ອງຢູ່ລະຫວ່າງ 1–50" };
  }

  const rawPhones = String(formData.get("phones") ?? "")
    .split(/[\s,;]+/)
    .filter(Boolean);
  const phones = rawPhones.filter((p) => toLaoMsisdn(p));
  if (phones.length === 0) {
    return { error: "ໃສ່ເບີຜູ້ຮັບຢ່າງໜ້ອຍ 1 ເບີ (ເຊັ່ນ 02078331163)" };
  }
  if (phones.length !== rawPhones.length) {
    const bad = rawPhones.filter((p) => !toLaoMsisdn(p));
    return { error: `ເບີບໍ່ຖືກຕ້ອງ: ${bad.join(", ")}` };
  }

  const now = new Date();
  const rows = Array.from({ length: count }, (_, i) => {
    const receiverName = `${pick(FIRST)} ${pick(LAST)}`;
    const senderName = `${pick(FIRST)} ${pick(LAST)}`;
    const phone = phones[i % phones.length];
    const weight = Math.round(between(0.2, 8) * 100) / 100;
    const size = Math.round(between(20, 120));
    const freight = Math.round(between(8, 60)) * 1000;
    const roll = Math.random();
    const payType =
      roll < 0.5
        ? "origin_freight_fees"
        : roll < 0.85
          ? "destination_freight_fees"
          : "origin_freight_fees_cod";
    const cod = payType.endsWith("cod") ? Math.round(between(50, 500)) * 1000 : null;
    const number = `VTE${String(Math.floor(Math.random() * 1e11)).padStart(11, "0")}`;
    const origin = pick(ORIGINS);
    const createdAt = new Date(now.getTime() - between(1, 48) * 3600_000).toISOString();

    return {
      shipment_number: number,
      shipment_type: "express",
      shipment_pay_type: payType,
      status_step: "in_transit",
      status_name: "ກຳລັງຂົນສົ່ງ",
      pieces: 1,
      total_freight: freight,
      total_price: cod ?? 0,
      sender_name: senderName,
      receiver_name: receiverName,
      receiver_phone: phone,
      end_branch_id: branch.id,
      weight_kg: weight,
      size_cm: size,
      cod_amount: cod,
      hal_created_at: createdAt,
      is_demo: true,
      parcel_status: "in_transit" as const,
      imported_by: profile.id,
      raw: {
        demo: true,
        shipment_number: number,
        shipment_pay_type: payType,
        total_freight: freight,
        total_price: cod ?? 0,
        parcel: {
          weight,
          weight_unit: "kg",
          dimension_length: size,
          parcel_category: { name: pick(CATEGORIES) },
        },
        sender_customer: { name: senderName, tel: "" },
        receiver_customer: { name: receiverName, tel: phone },
        start_branch: { name: origin },
        end_branch: { id: branch.id, name: branch.name, tel: branch.tel },
        created_at: createdAt,
      },
    };
  });

  const supabase = await createClient();
  const { error } = await supabase.from("shipments").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/branch");
  return { ok: `ສ້າງບິນ demo ${count} ບິນແລ້ວ (ສະຖານະ: ກຳລັງມາ)` };
}

export async function deleteDemoBills(): Promise<{ error?: string }> {
  const { branch } = await requireBranch();
  const supabase = await createClient();
  const { error } = await supabase
    .from("shipments")
    .delete()
    .eq("end_branch_id", branch.id)
    .eq("is_demo", true);
  revalidatePath("/branch");
  return error ? { error: error.message } : {};
}

// ---------------------------------------------------------------------------
// WhatsApp session of the branch
// ---------------------------------------------------------------------------

export type WaState = {
  status: SessionStatus | "not_connected";
  qr?: string;
  phone?: string | null;
  name?: string | null;
  error?: string;
};

async function saveWa(
  branchId: number,
  patch: { wa_session_id?: string | null; wa_status: string; wa_phone?: string | null; wa_name?: string | null },
) {
  const supabase = await createClient();
  await supabase
    .from("branches")
    .update({ ...patch, wa_updated_at: new Date().toISOString() })
    .eq("id", branchId);
}

export async function whatsappState(): Promise<WaState> {
  const { branch } = await requireBranch();
  if (!branch.wa_session_id) return { status: "not_connected" };

  try {
    const s = await openwa.getSession(branch.wa_session_id);
    const qr = s.status === "qr_ready"
      ? (await openwa.getQr(s.id).catch(() => null))?.qrCode
      : undefined;

    if (
      s.status !== branch.wa_status ||
      (s.phone ?? null) !== branch.wa_phone ||
      (s.pushName ?? null) !== branch.wa_name
    ) {
      await saveWa(branch.id, { wa_status: s.status, wa_phone: s.phone, wa_name: s.pushName });
    }
    return { status: s.status, qr, phone: s.phone, name: s.pushName, error: s.lastError ?? undefined };
  } catch (e) {
    if (e instanceof OpenWAError && e.status === 404) {
      await saveWa(branch.id, { wa_session_id: null, wa_status: "not_connected", wa_phone: null, wa_name: null });
      return { status: "not_connected" };
    }
    return { status: "failed", error: errorText(e) };
  }
}

export async function connectWhatsApp(): Promise<WaState> {
  const { branch } = await requireBranch();

  try {
    let id = branch.wa_session_id;
    if (id) {
      try {
        await openwa.getSession(id);
      } catch (e) {
        if (!(e instanceof OpenWAError && e.status === 404)) throw e;
        id = null;
      }
    }

    if (!id) {
      const name = branchSessionName(branch.id);
      const existing = (await openwa.listSessions()).find((s) => s.name === name);
      id = existing?.id ?? (await openwa.createSession(name)).id;
      await saveWa(branch.id, { wa_session_id: id, wa_status: "created" });
    }

    const s = await openwa.getSession(id);
    if (["created", "disconnected", "failed"].includes(s.status)) {
      await openwa.startSession(id);
    }
  } catch (e) {
    return { status: "failed", error: errorText(e) };
  }

  return whatsappState();
}

export async function logoutWhatsApp(): Promise<WaState> {
  const { branch } = await requireBranch();
  if (branch.wa_session_id) {
    await openwa.logout(branch.wa_session_id).catch(() => undefined);
    await saveWa(branch.id, { wa_status: "disconnected", wa_phone: null, wa_name: null });
  }
  revalidatePath("/branch", "layout");
  return { status: "disconnected" };
}

// ---------------------------------------------------------------------------
// Branch settings
// ---------------------------------------------------------------------------

const settings = z.object({
  staff_phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || toLaoMsisdn(v) !== null, "ເບີພະນັກງານບໍ່ຖືກຕ້ອງ"),
  pickup_days: z.coerce.number().int().min(1).max(60),
  auto_send: z.boolean(),
});

export type SettingsState = { ok?: string; error?: string };

export async function updateBranchSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { branch } = await requireBranch();
  const parsed = settings.safeParse({
    staff_phone: formData.get("staff_phone") ?? "",
    pickup_days: formData.get("pickup_days"),
    auto_send: formData.get("auto_send") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("branches")
    .update({ ...parsed.data, staff_phone: parsed.data.staff_phone || null })
    .eq("id", branch.id);
  if (error) return { error: error.message };

  revalidatePath("/branch", "layout");
  return { ok: "ບັນທຶກແລ້ວ" };
}
