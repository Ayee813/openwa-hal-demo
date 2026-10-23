import type { Metadata } from "next";
import { Suspense } from "react";
import { SEND_STATES, sendState, type Bill, type LatestMessage, type SendState } from "@/lib/bill";
import { loadBills } from "@/lib/bills-source";
import { laosDatePlus } from "@/lib/message";
import { latestMessages } from "@/lib/notify";
import { redirectIfSignedOut, requireBranch } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { arrivalTemplate } from "@/lib/template";
import type { BillFilter } from "../actions";
import { BillsTable } from "./bills-table";

export const metadata: Metadata = { title: "ເຄື່ອງຮອດສາຂາປາຍທາງ" };

const LIMITS = [10, 20, 50, 100];

export default function BillsPage({ searchParams }: PageProps<"/bills">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Bills searchParams={searchParams} />
    </Suspense>
  );
}

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

function isDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Matches bill number, phone or name, ignoring spaces and dashes in phones. */
function matches(b: Bill, q: string): boolean {
  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  return [b.billNumber, b.receiverName, b.senderName, b.trackingId].some((v) =>
    v?.toLowerCase().includes(needle),
  ) || (digits.length >= 4 && [b.receiverPhone, b.senderPhone].some((p) => p?.replace(/\D/g, "").includes(digits)));
}

async function Bills({ searchParams }: Pick<PageProps<"/bills">, "searchParams">) {
  const params = await searchParams;
  // Reads the session first: that makes the page request-time, so the clock
  // below is today's date, not the build's.
  const { session, branch } = await requireBranch();
  const today = laosDatePlus(0);
  const filter: BillFilter = {
    startDate: isDate(one(params.start)) ? one(params.start) : today,
    endDate: isDate(one(params.end)) ? one(params.end) : today,
    status: one(params.status) === "all" ? "" : "arrived_status",
  };
  const q = one(params.q);
  // Opens on the bills still to send; `send=all` shows every bill.
  const sendParam = one(params.send) || "not_sent";
  const send = SEND_STATES.some((s) => s.key === sendParam) ? (sendParam as SendState) : null;
  const limit = LIMITS.includes(Number(params.limit)) ? Number(params.limit) : 20;
  const page = Math.max(1, Number(one(params.page)) || 1);

  const query = { branchId: session.branchId, ...filter };

  let bills: Bill[] = [];
  let statuses: Record<string, LatestMessage> = {};
  const counts = Object.fromEntries(SEND_STATES.map((s) => [s.key, 0])) as Record<SendState, number>;
  let found = 0;
  let total = 0;
  let truncated = false;
  let error: string | null = null;
  const db = createAdminClient();

  try {
    // HAL has no text search or "sent" flag: read the whole range, then
    // search, count and filter here.
    const all = await loadBills(session, query, 1000);
    truncated = all.truncated;
    const matched = q ? all.bills.filter((b) => matches(b, q)) : all.bills;
    found = matched.length;

    const latest = await latestMessages(branch.id, matched.map((b) => b.billNumber), db);
    const shown = matched.filter((b) => {
      const { state } = sendState(b, latest[b.billNumber]);
      counts[state]++;
      return !send || state === send;
    });

    total = shown.length;
    bills = shown.slice((page - 1) * limit, page * limit);
    statuses = Object.fromEntries(
      bills.filter((b) => latest[b.billNumber]).map((b) => [b.billNumber, latest[b.billNumber]]),
    );
  } catch (e) {
    redirectIfSignedOut(e);
    error = (e as Error).message;
  }

  const template = await arrivalTemplate(branch, db);

  return (
    <BillsTable
      key={JSON.stringify({ filter, q, send, page, limit })}
      bills={bills}
      initialStatuses={statuses}
      filter={filter}
      q={q}
      send={send}
      counts={counts}
      found={found}
      page={page}
      limit={limit}
      lastPage={Math.max(1, Math.ceil(total / limit))}
      total={total}
      truncated={truncated}
      error={error}
      template={template.body}
      demo={session.demo ?? false}
      branch={{
        name: branch.name,
        district: branch.district,
        province: branch.province,
        tel: branch.tel,
        staff_phone: branch.staff_phone,
        pickup_days: branch.pickup_days,
        wa_ready: branch.wa_status === "ready",
      }}
    />
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-36 animate-pulse rounded-lg bg-white" />
      <div className="h-96 animate-pulse rounded-lg bg-white" />
    </div>
  );
}
