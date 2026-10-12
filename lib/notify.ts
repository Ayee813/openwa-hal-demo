import "server-only";

import { after } from "next/server";
import { renderMessage } from "@/lib/message";
import { OpenWAError, openwa } from "@/lib/openwa";
import { toChatId, toLaoMsisdn } from "@/lib/phone";
import type { createClient } from "@/lib/supabase/server";
import type {
  Branch,
  MessageKind,
  MessageStatus,
  Profile,
  Shipment,
} from "@/lib/types";

/**
 * Sending WhatsApp notifications for a branch.
 *
 * `queueMessages` writes one `message_logs` row per bill (status `queued`) and
 * returns at once; the actual sending runs after the response with a 3–6 s gap
 * between messages, so a branch number is not flagged for spam. Every write
 * goes through the caller's RLS-scoped client — the branch can only touch its
 * own bills and logs.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SHIPMENT_FIELDS =
  "id, shipment_number, receiver_name, receiver_phone, weight_kg, size_cm, shipment_pay_type, total_freight, cod_amount, pickup_deadline, parcel_status, end_branch_id";

type QueueShipment = Pick<
  Shipment,
  | "id"
  | "shipment_number"
  | "receiver_name"
  | "receiver_phone"
  | "weight_kg"
  | "size_cm"
  | "shipment_pay_type"
  | "total_freight"
  | "cod_amount"
  | "pickup_deadline"
  | "parcel_status"
  | "end_branch_id"
>;

/** Which bills each message kind may go to. */
const SENDABLE: Record<MessageKind, Shipment["parcel_status"][]> = {
  arrival: ["arrived", "notified"],
  reminder: ["notified"],
};

export type QueueResult = { queued: number; skipped: string[]; error?: string };

/** Midnight today in Laos, as an ISO instant. */
function laosMidnight(): string {
  const now = new Date(Date.now() + 7 * 3600_000);
  return `${now.toISOString().slice(0, 10)}T00:00:00+07:00`;
}

/** The branch's WhatsApp session, only if it is connected right now. */
export async function readySession(branch: Branch): Promise<string> {
  if (!branch.wa_session_id) {
    throw new OpenWAError("ສາຂານີ້ຍັງບໍ່ໄດ້ເຊື່ອມ WhatsApp", 409);
  }
  const s = await openwa.getSession(branch.wa_session_id);
  if (s.status !== "ready") {
    throw new OpenWAError(
      `WhatsApp ຂອງສາຂາບໍ່ພ້ອມ (ສະຖານະ: ${s.status}). ເຂົ້າໜ້າ WhatsApp ເພື່ອເຊື່ອມຄືນ`,
      409,
    );
  }
  return s.id;
}

export async function queueMessages(
  supabase: Supabase,
  profile: Profile,
  branch: Branch,
  shipmentIds: number[],
  kind: MessageKind,
): Promise<QueueResult> {
  if (shipmentIds.length === 0) return { queued: 0, skipped: [], error: "ເລືອກບິນກ່ອນ" };

  let sessionId: string;
  try {
    sessionId = await readySession(branch);
  } catch (e) {
    return { queued: 0, skipped: [], error: (e as Error).message };
  }

  const [{ data: rows, error }, { data: template }, { count: sentToday }] =
    await Promise.all([
      supabase
        .from("shipments")
        .select(SHIPMENT_FIELDS)
        .in("id", shipmentIds)
        .eq("end_branch_id", branch.id)
        .returns<QueueShipment[]>(),
      supabase.from("message_templates").select("body").eq("key", kind).maybeSingle(),
      supabase
        .from("message_logs")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branch.id)
        .gte("created_at", laosMidnight()),
    ]);

  if (error) return { queued: 0, skipped: [], error: error.message };
  if (!template) return { queued: 0, skipped: [], error: "ບໍ່ພົບແມ່ແບບຂໍ້ຄວາມ" };

  const skipped: string[] = [];
  const sendable = (rows ?? []).filter((s) => {
    if (SENDABLE[kind].includes(s.parcel_status)) return true;
    skipped.push(s.shipment_number);
    return false;
  });

  const left = branch.daily_limit - (sentToday ?? 0);
  if (sendable.length > left) {
    return {
      queued: 0,
      skipped,
      error: `ເກີນເພດານສົ່ງຕໍ່ວັນ (${branch.daily_limit}). ມື້ນີ້ເຫຼືອ ${Math.max(left, 0)} ຂໍ້ຄວາມ`,
    };
  }
  if (sendable.length === 0) {
    return { queued: 0, skipped, error: "ບໍ່ມີບິນທີ່ສົ່ງໄດ້ໃນລາຍການທີ່ເລືອກ" };
  }

  const logs = sendable.map((s) => {
    const msisdn = toLaoMsisdn(s.receiver_phone);
    return {
      shipment_id: s.id,
      branch_id: branch.id,
      kind,
      phone: msisdn ?? s.receiver_phone ?? "",
      chat_id: msisdn ? toChatId(msisdn) : null,
      body: renderMessage(template.body, s, branch),
      status: (msisdn ? "queued" : "failed") as MessageStatus,
      error: msisdn ? null : "ເບີໂທບໍ່ຖືກຕ້ອງ",
      sent_by: profile.id,
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from("message_logs")
    .insert(logs)
    .select("id, shipment_id, chat_id, body, status");
  if (insertError) return { queued: 0, skipped, error: insertError.message };

  const now = new Date().toISOString();
  await Promise.all(
    inserted.map((l) =>
      supabase
        .from("shipments")
        .update({ last_message_status: l.status, last_message_at: now })
        .eq("id", l.shipment_id),
    ),
  );

  const jobs = inserted.filter((l) => l.status === "queued" && l.chat_id);
  after(() => deliver(supabase, sessionId, kind, jobs));

  return { queued: jobs.length, skipped };
}

type Job = { id: number; shipment_id: number; chat_id: string | null; body: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function deliver(
  supabase: Supabase,
  sessionId: string,
  kind: MessageKind,
  jobs: Job[],
) {
  for (const [i, job] of jobs.entries()) {
    if (i > 0) await sleep(3000 + Math.random() * 3000);

    let status: MessageStatus;
    let patch: { chat_id?: string; wa_message_id?: string; error?: string | null } = {};

    try {
      const msisdn = job.chat_id!.replace(/@.*/, "");
      const check = await openwa.checkNumber(sessionId, msisdn);
      if (!check.exists) {
        status = "no_whatsapp";
        patch = { error: "ເບີນີ້ບໍ່ມີ WhatsApp" };
      } else {
        const chatId = check.whatsappId ?? job.chat_id!;
        const sent = await openwa.sendText(sessionId, chatId, job.body);
        status = "sent";
        patch = { chat_id: chatId, wa_message_id: sent.messageId, error: null };
      }
    } catch (e) {
      status = "failed";
      patch = { error: e instanceof Error ? e.message.slice(0, 500) : String(e) };
    }

    const now = new Date().toISOString();
    await supabase
      .from("message_logs")
      .update({ status, ...patch, updated_at: now })
      .eq("id", job.id);

    await supabase
      .from("shipments")
      .update({
        last_message_status: status,
        last_message_at: now,
        ...(status === "sent" && kind === "arrival"
          ? { parcel_status: "notified" as const }
          : {}),
      })
      .eq("id", job.shipment_id);
  }
}

/**
 * Pulls delivery / read receipts for recent messages from the gateway. OpenWA's
 * webhooks cannot reach localhost (its SSRF guard blocks private addresses), so
 * the bills page polls this instead.
 */
export async function syncStatuses(supabase: Supabase, branch: Branch) {
  if (!branch.wa_session_id) return 0;

  const since = new Date(Date.now() - 3 * 86400_000).toISOString();
  const { data: logs } = await supabase
    .from("message_logs")
    .select("id, shipment_id, chat_id, wa_message_id, status")
    .eq("branch_id", branch.id)
    .in("status", ["sent", "delivered"])
    .not("wa_message_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(25);

  let changed = 0;
  for (const log of logs ?? []) {
    const remote = await openwa
      .messageStatus(branch.wa_session_id, log.chat_id!, log.wa_message_id!)
      .catch(() => null);

    const next: MessageStatus | null =
      remote === "read" || remote === "delivered" || remote === "failed" ? remote : null;
    if (!next || next === log.status) continue;

    changed++;
    const now = new Date().toISOString();
    await supabase
      .from("message_logs")
      .update({ status: next, updated_at: now })
      .eq("id", log.id);
    await supabase
      .from("shipments")
      .update({ last_message_status: next })
      .eq("id", log.shipment_id);
  }
  return changed;
}
