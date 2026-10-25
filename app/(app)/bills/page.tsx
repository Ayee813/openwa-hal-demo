import type { Metadata } from "next";
import { Suspense } from "react";
import { SEND_STATES, type Bill, type SendState } from "@/lib/bill";
import { loadBillsForPage } from "@/lib/bills-source";
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

  const db = createAdminClient();
  // HAL has no text search or "sent" flag: read the whole range and search it
  // here. Tabs and pages are then switched in the browser, with no reload.
  const [loaded, template] = await Promise.all([
    loadBillsForPage(session, { branchId: session.branchId, ...filter }, 1000).catch((e: unknown) => {
      redirectIfSignedOut(e);
      return { error: (e as Error).message };
    }),
    arrivalTemplate(branch, db),
  ]);
  const error = "error" in loaded ? loaded.error : null;
  const bills: Bill[] = "bills" in loaded ? (q ? loaded.bills.filter((b) => matches(b, q)) : loaded.bills) : [];
  const truncated = "truncated" in loaded && loaded.truncated;
  const statuses = await latestMessages(branch.id, bills.map((b) => b.billNumber), db);

  return (
    <BillsTable
      // Only a new search remounts the table; tab, page and per-page are its own state.
      key={JSON.stringify({ filter, q })}
      bills={bills}
      initialStatuses={statuses}
      filter={filter}
      q={q}
      initialSend={send}
      initialPage={page}
      initialLimit={limit}
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

/** Shaped like the real page, so the first load doesn't jump. */
function Skeleton() {
  const bar = "animate-pulse rounded bg-zinc-200/70";
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="ກຳລັງໂຫຼດບິນ">
      <div className="flex flex-col gap-4 rounded-lg bg-white px-5 py-4">
        <div className={`${bar} h-6 w-64`} />
        <div className="grid gap-3 md:grid-cols-[2fr_1.3fr_1.3fr_1fr_0.7fr_auto_auto]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className={`${bar} h-3.5 w-16`} />
              <div className={`${bar} h-9`} />
            </div>
          ))}
          <div className={`${bar} h-9 self-end md:w-28`} />
          <div className={`${bar} h-9 self-end md:w-24`} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-white" />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg bg-white">
        <div className="h-14 border-b border-line bg-head" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-line px-4 py-5">
            <div className={`${bar} size-4`} />
            <div className={`${bar} h-4 w-6`} />
            <div className={`${bar} h-4 w-28`} />
            <div className={`${bar} h-4 w-24`} />
            <div className={`${bar} hidden h-4 w-32 md:block`} />
            <div className={`${bar} hidden h-4 flex-1 lg:block`} />
          </div>
        ))}
      </div>
    </div>
  );
}
