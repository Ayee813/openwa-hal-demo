import "server-only";

import { after } from "next/server";
import { SENT, billMessage, type Bill, type LatestMessage } from "@/lib/bill";
import { laosDatePlus } from "@/lib/message";
import { OpenWAError, openwa } from "@/lib/openwa";
import { phoneProblem, toChatId, toLaoMsisdn } from "@/lib/phone";
import type { Session } from "@/lib/session";
import { arrivalTemplate } from "@/lib/template";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Branch, MessageStatus } from "@/lib/types";

/**
 * Sending WhatsApp bill notifications for a branch.
 *
 * `queueBills` writes one `message_logs` row per bill (status `queued`) and
 * returns at once; the sending runs after the response with a 3–6 s gap
 * between messages, so the branch number is not flagged for spam.
 *
 * Bills always come from the HAL API on the server (never from the browser),
 * and every query is scoped to the session's branch id. The secret-key client
 * is used because users sign in with HAL, not Supabase.
 */

type Db = ReturnType<typeof createAdminClient>;

export type QueueResult = {
  queued: number;
  alreadySent: number;
  /** Skipped: bad or 030 number, or a number already found without WhatsApp. */
  cannot: number;
  error?: string;
  /** The branch's WhatsApp isn't connected: send staff to the WhatsApp page. */
  needsWhatsApp?: boolean;
};

function laosMidnight(): string {
  return `${laosDatePlus(0)}T00:00:00+07:00`;
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

/** Latest message per bill number for this branch. */
export async function latestMessages(
  branchId: number,
  billNumbers: string[],
  db: Db = createAdminClient(),
): Promise<Record<string, LatestMessage>> {
  // In chunks, so the `in (...)` filter stays within URL length limits.
  const chunks: string[][] = [];
  for (let i = 0; i < billNumbers.length; i += 200) chunks.push(billNumbers.slice(i, i + 200));
  const results = await Promise.all(
    chunks.map((chunk) =>
      db
        .from("message_logs")
        .select("bill_number, status, error, created_at")
        .eq("branch_id", branchId)
        .in("bill_number", chunk)
        .order("created_at", { ascending: false }),
    ),
  );

  const out: Record<string, LatestMessage> = {};
  for (const row of results.flatMap((r) => r.data ?? [])) {
    if (row.bill_number && !out[row.bill_number]) {
      out[row.bill_number] = { status: row.status, error: row.error, at: row.created_at };
    }
  }
  return out;
}

export async function queueBills(
  session: Session,
  branch: Branch,
  bills: Bill[],
  { resend = false }: { resend?: boolean } = {},
): Promise<QueueResult> {
  const result: QueueResult = { queued: 0, alreadySent: 0, cannot: 0 };
  if (bills.length === 0) return { ...result, error: "ບໍ່ມີບິນທີ່ຈະສົ່ງ" };

  let sessionId: string;
  try {
    sessionId = await readySession(branch);
  } catch (e) {
    const notReady = e instanceof OpenWAError && e.status === 409;
    return { ...result, error: (e as Error).message, ...(notReady ? { needsWhatsApp: true } : {}) };
  }

  const db = createAdminClient();
  const [template, { count: sentToday }, latest] = await Promise.all([
    arrivalTemplate(branch, db),
    db
      .from("message_logs")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branch.id)
      .gte("created_at", laosMidnight()),
    latestMessages(
      branch.id,
      bills.map((b) => b.billNumber),
    ),
  ]);
  if (!template.body) return { ...result, error: "ບໍ່ພົບແມ່ແບບຂໍ້ຄວາມ" };

  // One message per bill number. Numbers that can't get WhatsApp are never
  // sent; ones already sent, or already found without WhatsApp, only on resend.
  const seen = new Set<string>();
  const todo = bills.filter((b) => {
    if (seen.has(b.billNumber)) return false;
    seen.add(b.billNumber);
    const prev = latest[b.billNumber];
    if (phoneProblem(b.receiverPhone) || (!resend && prev?.status === "no_whatsapp")) {
      result.cannot++;
      return false;
    }
    if (!resend && prev && SENT.includes(prev.status)) {
      result.alreadySent++;
      return false;
    }
    return true;
  });

  if (todo.length === 0) {
    return {
      ...result,
      error: result.cannot && !result.alreadySent
        ? "ບິນທີ່ເລືອກສົ່ງບໍ່ໄດ້ (ເບີໂທບໍ່ຖືກຕ້ອງ ຫຼື ບໍ່ມີ WhatsApp)"
        : "ບິນທີ່ເລືອກສົ່ງແລ້ວ ຫຼື ສົ່ງບໍ່ໄດ້ທັງໝົດ",
    };
  }

  const left = branch.daily_limit - (sentToday ?? 0);
  if (todo.length > left) {
    return {
      ...result,
      error: `ເກີນເພດານສົ່ງຕໍ່ວັນ (${branch.daily_limit}). ມື້ນີ້ເຫຼືອ ${Math.max(left, 0)} ຂໍ້ຄວາມ`,
    };
  }

  const rows = todo.map((b) => {
    const msisdn = toLaoMsisdn(b.receiverPhone)!;
    const body = billMessage(template.body, b, {
      name: branch.name,
      district: branch.district,
      province: branch.province,
      tel: branch.tel,
      staff_phone: branch.staff_phone,
      pickup_days: branch.pickup_days,
    });
    return {
      branch_id: branch.id,
      bill_number: b.billNumber,
      tracking_id: b.trackingId,
      receiver_name: b.receiverName,
      kind: "arrival" as const,
      phone: msisdn,
      chat_id: toChatId(msisdn),
      body,
      status: "queued" as MessageStatus,
      error: null,
      hal_user_id: session.userId,
      sent_by_name: session.name,
    };
  });

  const { data: inserted, error } = await db
    .from("message_logs")
    .insert(rows)
    .select("id, chat_id, body, status");
  if (error) return { ...result, error: error.message };

  const jobs = inserted.filter((l) => l.status === "queued" && l.chat_id);
  result.queued = jobs.length;
  after(() => deliver(db, sessionId, jobs, branch.wa_phone));
  return result;
}

type Job = { id: number; chat_id: string | null; body: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gateway calls that fail this many times in a row end the batch. */
const MAX_FAILS_IN_A_ROW = 3;

/** A 5xx from OpenWA: the gateway or its browser is broken, not the number. */
function gatewayDown(e: unknown): boolean {
  return e instanceof OpenWAError && e.status >= 500;
}

/**
 * Whether the session can really reach WhatsApp. After its Chrome crashes,
 * OpenWA can report the session "ready" while WhatsApp Web inside never
 * reconnected, and every call fails with a 500 ("sendIq called before
 * startComms"). Looking up the branch's own number shows that cheaply.
 */
async function sessionWorks(sessionId: string, ownPhone: string | null): Promise<boolean> {
  if (!ownPhone) return true;
  try {
    await openwa.checkNumber(sessionId, ownPhone.replace(/\D/g, ""));
    return true;
  } catch (e) {
    if (gatewayDown(e)) return false;
    throw e;
  }
}

/**
 * Stops and starts the session, which relaunches its browser with the saved
 * login (no new QR), and waits up to ~90 s for it to be ready again.
 */
export async function restartSession(sessionId: string): Promise<boolean> {
  await openwa.stopSession(sessionId).catch(() => undefined);
  await openwa.startSession(sessionId).catch(() => undefined);
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const s = await openwa.getSession(sessionId).catch(() => null);
    if (s?.status === "ready") {
      await sleep(3000); // WhatsApp Web finishes connecting just after "ready"
      return true;
    }
    if (s && ["qr_ready", "failed", "action_required", "disconnected"].includes(s.status)) return false;
  }
  return false;
}

async function deliver(db: Db, sessionId: string, jobs: Job[], ownPhone: string | null) {
  let restarted = false;
  let failsInARow = 0;

  // Repair a session that only looks ready before sending anything.
  if (!(await sessionWorks(sessionId, ownPhone).catch(() => true))) {
    restarted = true;
    if (!(await restartSession(sessionId))) return giveBack(db, jobs, 0);
  }

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]!;
    if (i > 0) await sleep(3000 + Math.random() * 3000);

    let status: MessageStatus;
    let patch: { chat_id?: string; wa_message_id?: string; error?: string | null } = {};

    try {
      ({ status, patch } = await sendOne(sessionId, job));
      failsInARow = 0;
    } catch (e) {
      // The first time the gateway breaks mid-batch, restart it and retry this bill once.
      if (gatewayDown(e) && !restarted) {
        restarted = true;
        if (await restartSession(sessionId)) {
          i--;
          continue;
        }
        return giveBack(db, jobs, i);
      }
      status = "failed";
      patch = { error: e instanceof Error ? e.message.slice(0, 500) : String(e) };
      if (gatewayDown(e) && ++failsInARow >= MAX_FAILS_IN_A_ROW) {
        await setStatus(db, job.id, status, patch);
        return giveBack(db, jobs, i + 1);
      }
    }

    await setStatus(db, job.id, status, patch);
  }
}

async function sendOne(
  sessionId: string,
  job: Job,
): Promise<{ status: MessageStatus; patch: { chat_id?: string; wa_message_id?: string; error?: string | null } }> {
  const msisdn = job.chat_id!.replace(/@.*/, "");
  const check = await openwa.checkNumber(sessionId, msisdn);
  if (!check.exists) return { status: "no_whatsapp", patch: { error: "ເບີນີ້ບໍ່ມີ WhatsApp" } };
  const chatId = check.whatsappId ?? job.chat_id!;
  const sent = await openwa.sendText(sessionId, chatId, job.body);
  return { status: "sent", patch: { chat_id: chatId, wa_message_id: sent.messageId, error: null } };
}

function setStatus(
  db: Db,
  id: number,
  status: MessageStatus,
  patch: { chat_id?: string; wa_message_id?: string; error?: string | null },
) {
  return db
    .from("message_logs")
    .update({ status, ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * The gateway can't send: drop the queued rows from `from` on, so those bills
 * go back to "not sent" instead of piling up as failures.
 */
async function giveBack(db: Db, jobs: Job[], from: number) {
  const ids = jobs.slice(from).map((j) => j.id);
  if (ids.length) await db.from("message_logs").delete().in("id", ids).eq("status", "queued");
}

/**
 * Pulls delivery / read receipts for recent messages from the gateway. OpenWA's
 * webhooks cannot reach localhost (its SSRF guard blocks private addresses), so
 * the bills page polls this instead.
 */
export async function syncStatuses(branch: Branch, db: Db = createAdminClient()) {
  if (!branch.wa_session_id) return 0;

  const since = new Date(Date.now() - 3 * 86400_000).toISOString();
  const { data: logs } = await db
    .from("message_logs")
    .select("id, chat_id, wa_message_id, status")
    .eq("branch_id", branch.id)
    .in("status", ["sent", "delivered"])
    .not("wa_message_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(25);

  const sessionId = branch.wa_session_id;
  let changed = 0;
  // A few at a time: quicker than one by one, without crowding the gateway's browser.
  const rows = logs ?? [];
  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(
      rows.slice(i, i + 5).map(async (log) => {
        const remote = await openwa
          .messageStatus(sessionId, log.chat_id!, log.wa_message_id!)
          .catch(() => null);

        const next: MessageStatus | null =
          remote === "read" || remote === "delivered" || remote === "failed" ? remote : null;
        if (!next || next === log.status) return;

        changed++;
        await db
          .from("message_logs")
          .update({ status: next, updated_at: new Date().toISOString() })
          .eq("id", log.id);
      }),
    );
  }
  return changed;
}
