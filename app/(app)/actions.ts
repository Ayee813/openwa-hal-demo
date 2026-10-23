"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadBills } from "@/lib/bills-source";
import { DEMO_BRANCH_ID, generateDemoBills } from "@/lib/demo";
import type { LatestMessage } from "@/lib/bill";
import { latestMessages, queueBills, syncStatuses, type QueueResult } from "@/lib/notify";
import { OpenWAError, branchSessionName, openwa, type SessionStatus } from "@/lib/openwa";
import { PLACEHOLDERS } from "@/lib/message";
import { toLaoMsisdn } from "@/lib/phone";
import { redirectIfSignedOut, requireBranch } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------------------
// Sending bills
// ---------------------------------------------------------------------------

const filter = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  status: z.enum(["arrived_status", ""]),
});

export type BillFilter = z.infer<typeof filter>;

const request = z.object({
  filter,
  /** Bill numbers to send; omitted means every bill in the filter. */
  billNumbers: z.array(z.string().min(1).max(60)).max(500).optional(),
  resend: z.boolean().default(false),
});

/**
 * Sends WhatsApp messages for the selected bills, or for every bill in the
 * date range. The bills are re-read from HAL here with the user's own token
 * (or from demo_bills for the development account),
 * so the browser can only pick which of its branch's bills to send, never
 * supply a phone number or text.
 */
export async function sendBills(input: z.input<typeof request>): Promise<QueueResult> {
  const parsed = request.safeParse(input);
  const empty = { queued: 0, alreadySent: 0, cannot: 0 };
  if (!parsed.success) return { ...empty, error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };

  const { session, branch } = await requireBranch();
  const { filter: f, billNumbers, resend } = parsed.data;

  let bills;
  try {
    ({ bills } = await loadBills(session, { branchId: session.branchId, ...f }, 1000));
  } catch (e) {
    redirectIfSignedOut(e);
    return { ...empty, error: errorText(e) };
  }

  const wanted = billNumbers ? new Set(billNumbers) : null;
  const chosen = wanted ? bills.filter((b) => wanted.has(b.billNumber)) : bills;
  if (chosen.length > 500) {
    return { ...empty, error: `ມີ ${chosen.length} ບິນ, ສົ່ງໄດ້ສູງສຸດ 500 ຕໍ່ຄັ້ງ. ເລືອກຊ່ວງວັນທີໃຫ້ສັ້ນລົງ` };
  }

  return queueBills(session, branch, chosen, { resend });
}

/** Latest WhatsApp status of the bills on screen; polled while messages are in flight. */
export async function billStatuses(
  billNumbers: string[],
): Promise<Record<string, LatestMessage>> {
  const numbers = z.array(z.string().max(60)).max(100).safeParse(billNumbers);
  if (!numbers.success) return {};
  const { branch } = await requireBranch();
  const db = createAdminClient();
  await syncStatuses(branch, db);
  return latestMessages(branch.id, numbers.data, db);
}

// ---------------------------------------------------------------------------
// Mock bills (development account only)
// ---------------------------------------------------------------------------

const generate = z.object({
  count: z.coerce.number().int().min(1, "ຢ່າງໜ້ອຍ 1 ບິນ").max(50, "ສູງສຸດ 50 ບິນ"),
  phones: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v.split(/[|,;/\s]+/).filter(Boolean))
    .refine((nums) => nums.length > 0, "ໃສ່ເບີຜູ້ຮັບຢ່າງໜ້ອຍ 1 ເບີ")
    .refine((nums) => nums.length <= 10, "ໃສ່ໄດ້ສູງສຸດ 10 ເບີ")
    .refine((nums) => nums.every((n) => toLaoMsisdn(n) !== null), "ມີເບີໂທທີ່ບໍ່ຖືກຕ້ອງ"),
  date: z.iso.date(),
  includeBad: z.boolean(),
});

export type DemoState = { ok?: string; error?: string };

/** Makes mock parcels that "arrived" at the demo branch, sent to the given numbers. */
export async function generateBills(_prev: DemoState, formData: FormData): Promise<DemoState> {
  const { session } = await requireBranch();
  if (!session.demo || session.branchId !== DEMO_BRANCH_ID) return { error: "ສະເພາະບັນຊີທົດລອງ" };

  const parsed = generate.safeParse({
    count: formData.get("count"),
    phones: formData.get("phones") ?? "",
    date: formData.get("date"),
    includeBad: formData.get("includeBad") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };

  const rows = generateDemoBills(parsed.data);
  const { error } = await createAdminClient()
    .from("demo_bills")
    .upsert(rows, { onConflict: "branch_id,bill_number", ignoreDuplicates: true });
  if (error) return { error: error.message };

  revalidatePath("/bills");
  return { ok: `ສ້າງ ${rows.length} ບິນແລ້ວ (ວັນທີ ${parsed.data.date})` };
}

/** Deletes every mock bill and its message log. */
export async function resetDemo(): Promise<DemoState> {
  const { session } = await requireBranch();
  if (!session.demo || session.branchId !== DEMO_BRANCH_ID) return { error: "ສະເພາະບັນຊີທົດລອງ" };

  const db = createAdminClient();
  const [bills, logs] = await Promise.all([
    db.from("demo_bills").delete().eq("branch_id", session.branchId),
    db.from("message_logs").delete().eq("branch_id", session.branchId),
  ]);
  const error = bills.error ?? logs.error;
  if (error) return { error: error.message };

  revalidatePath("/bills");
  return { ok: "ລຶບຂໍ້ມູນທົດລອງແລ້ວ" };
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
  await createAdminClient()
    .from("branches")
    .update({ ...patch, wa_updated_at: new Date().toISOString() })
    .eq("id", branchId);
}

export async function whatsappState(): Promise<WaState> {
  const { branch } = await requireBranch();
  if (!branch.wa_session_id) return { status: "not_connected" };

  try {
    const s = await openwa.getSession(branch.wa_session_id);
    const qr =
      s.status === "qr_ready" ? (await openwa.getQr(s.id).catch(() => null))?.qrCode : undefined;

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
  revalidatePath("/", "layout");
  return { status: "disconnected" };
}

// ---------------------------------------------------------------------------
// Branch settings
// ---------------------------------------------------------------------------

/** "02052415523, 02054656540" → "02052415523 | 02054656540"; every number must be valid. */
const phoneList = z
  .string()
  .trim()
  .max(120)
  .transform((v) => v.split(/[|,;/\s]+/).filter(Boolean))
  .refine((nums) => nums.every((n) => toLaoMsisdn(n) !== null), "ມີເບີໂທທີ່ບໍ່ຖືກຕ້ອງ")
  .refine((nums) => nums.length <= 4, "ໃສ່ໄດ້ສູງສຸດ 4 ເບີ")
  .transform((nums) => nums.join(" | "));

const settings = z.object({
  staff_phone: phoneList,
  pickup_days: z.coerce.number().int().min(1).max(60),
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
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };

  const { error } = await createAdminClient()
    .from("branches")
    .update({ ...parsed.data, staff_phone: parsed.data.staff_phone || null })
    .eq("id", branch.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: "ບັນທຶກແລ້ວ" };
}

// ---------------------------------------------------------------------------
// The branch's own arrival message
// ---------------------------------------------------------------------------

const templateBody = z
  .string()
  .trim()
  .min(1, "ຂໍ້ຄວາມຫວ່າງບໍ່ໄດ້")
  .max(2000, "ຂໍ້ຄວາມຍາວເກີນ 2000 ຕົວອັກສອນ")
  .refine((v) => v.includes("{shipment_number}"), "ຕ້ອງມີ {shipment_number} ເພື່ອໃຫ້ລູກຄ້າຮູ້ເລກບິນ")
  .superRefine((v, ctx) => {
    const unknown = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).filter((k) => !(k in PLACEHOLDERS));
    if (unknown.length) ctx.addIssue({ code: "custom", message: `ບໍ່ຮູ້ຈັກ {${unknown[0]}}` });
  });

/** Saves the branch's wording; `reset` goes back to the shared template. */
export async function updateTemplate(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { branch } = await requireBranch();
  const reset = formData.get("reset") === "1";
  const parsed = reset ? null : templateBody.safeParse(formData.get("body") ?? "");
  if (parsed && !parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };

  const { error } = await createAdminClient()
    .from("branches")
    .update({ arrival_template: parsed?.data ?? null })
    .eq("id", branch.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: reset ? "ກັບໄປໃຊ້ຂໍ້ຄວາມມາດຕະຖານແລ້ວ" : "ບັນທຶກຂໍ້ຄວາມແລ້ວ" };
}
