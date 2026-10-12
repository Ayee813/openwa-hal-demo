import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireBranch } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MessageStatus, ParcelStatus } from "@/lib/types";
import { BillsTable, type BillRow } from "./bills-table";

export const metadata: Metadata = { title: "ລາຍການບິນ" };

const TABS = [
  { key: "all", label: "ທັງໝົດ" },
  { key: "incoming", label: "ກຳລັງມາ" },
  { key: "arrived", label: "ຮອດສາຂາ (ຍັງບໍ່ແຈ້ງ)" },
  { key: "notified", label: "ແຈ້ງແລ້ວ" },
  { key: "failed", label: "ສົ່ງບໍ່ສຳເລັດ" },
  { key: "picked_up", label: "ຮັບແລ້ວ" },
] as const;

type Tab = (typeof TABS)[number]["key"];

const FAILED: MessageStatus[] = ["failed", "no_whatsapp"];

function inTab(tab: Tab, p: ParcelStatus, m: MessageStatus | null): boolean {
  switch (tab) {
    case "all":
      return true;
    case "incoming":
      return p === "in_transit";
    case "failed":
      return (p === "arrived" || p === "notified") && m !== null && FAILED.includes(m);
    default:
      return p === tab;
  }
}

export default function BranchBillsPage({ searchParams }: PageProps<"/branch">) {
  return (
    <Suspense fallback={<p className="text-zinc-500">ກຳລັງໂຫຼດ…</p>}>
      <Bills searchParams={searchParams} />
    </Suspense>
  );
}

async function Bills({ searchParams }: Pick<PageProps<"/branch">, "searchParams">) {
  const params = await searchParams;
  const tab = (TABS.find((t) => t.key === params.tab)?.key ?? "all") as Tab;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const { branch } = await requireBranch();
  const supabase = await createClient();

  let query = supabase
    .from("shipments")
    .select(
      "id, shipment_number, receiver_name, receiver_phone, weight_kg, size_cm, shipment_pay_type, total_freight, cod_amount, pickup_deadline, parcel_status, arrived_at, is_demo, last_message_status, last_message_at, hal_created_at",
    )
    .eq("end_branch_id", branch.id)
    .order("arrived_at", { ascending: false, nullsFirst: false })
    .order("hal_created_at", { ascending: false })
    .limit(300);

  if (tab === "incoming") query = query.eq("parcel_status", "in_transit");
  else if (tab === "failed")
    query = query.in("parcel_status", ["arrived", "notified"]).in("last_message_status", FAILED);
  else if (tab !== "all") query = query.eq("parcel_status", tab);

  if (q) {
    const safe = q.replace(/[%,()*]/g, "");
    query = query.or(`shipment_number.ilike.%${safe}%,receiver_phone.ilike.%${safe}%,receiver_name.ilike.%${safe}%`);
  }

  const [{ data: rows, error }, { data: all }, { data: templates }] = await Promise.all([
    query.returns<BillRow[]>(),
    supabase
      .from("shipments")
      .select("parcel_status, last_message_status")
      .eq("end_branch_id", branch.id),
    supabase.from("message_templates").select("key, body"),
  ]);

  const counts = Object.fromEntries(
    TABS.map((t) => [
      t.key,
      (all ?? []).filter((s) => inTab(t.key, s.parcel_status, s.last_message_status)).length,
    ]),
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ລາຍການບິນ</h1>
          <p className="text-sm text-zinc-500">
            ບິນທີ່ປາຍທາງແມ່ນສາຂາ {branch.name}. ເລືອກບິນແລ້ວກົດສົ່ງ ເພື່ອແຈ້ງລູກຄ້າທາງ WhatsApp.
          </p>
        </div>
        <form className="flex gap-2" action="/branch">
          <input type="hidden" name="tab" value={tab} />
          <input
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາ ເລກບິນ / ເບີ / ຊື່"
            className="w-56 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
            ຄົ້ນຫາ
          </button>
        </form>
      </div>

      {branch.wa_status !== "ready" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <span>WhatsApp ຂອງສາຂາຍັງບໍ່ໄດ້ເຊື່ອມ, ຍັງສົ່ງບິນບໍ່ໄດ້.</span>
          <Link href="/branch/whatsapp" className="font-medium underline">
            ເຊື່ອມ WhatsApp →
          </Link>
        </div>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={{ pathname: "/branch", query: { tab: t.key, ...(q ? { q } : {}) } }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              t.key === tab
                ? "border-red-600 font-medium text-red-700 dark:text-red-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {t.label}{" "}
            <span className="rounded-full bg-zinc-100 px-1.5 text-xs tabular-nums dark:bg-zinc-800">
              {counts[t.key]}
            </span>
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : (
        <BillsTable
          key={`${tab}:${q}`}
          rows={rows ?? []}
          branch={{
            name: branch.name,
            district: branch.district,
            tel: branch.tel,
            staff_phone: branch.staff_phone,
            pickup_days: branch.pickup_days,
            wa_ready: branch.wa_status === "ready",
          }}
          templates={Object.fromEntries((templates ?? []).map((t) => [t.key, t.body]))}
        />
      )}
    </>
  );
}
