import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WaBadge } from "@/components/badges";
import { requireProfile } from "@/lib/auth";
import { openwa, type WaSession } from "@/lib/openwa";
import { formatLaoPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ພາບລວມ" };

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="text-zinc-500">ກຳລັງໂຫຼດ…</p>}>
      <Dashboard />
    </Suspense>
  );
}

function laosMidnight() {
  const now = new Date(Date.now() + 7 * 3600_000);
  return `${now.toISOString().slice(0, 10)}T00:00:00+07:00`;
}

async function Dashboard() {
  await requireProfile("admin");
  const supabase = await createClient();

  const [{ data: shipments }, { data: branches }, { data: logs }, { data: users }, sessions] =
    await Promise.all([
      supabase.from("shipments").select("end_branch_id, parcel_status, last_message_status"),
      supabase.from("branches").select("*").order("name"),
      supabase.from("message_logs").select("branch_id, status").gte("created_at", laosMidnight()),
      supabase.from("profiles").select("branch_id, role, is_active"),
      openwa.listSessions().catch(() => null as WaSession[] | null),
    ]);

  const all = shipments ?? [];
  const count = (p: (s: (typeof all)[number]) => boolean) => all.filter(p).length;
  const today = logs ?? [];
  const live = new Map((sessions ?? []).map((s) => [s.id, s]));

  const cards = [
    { label: "ບິນທັງໝົດ", value: all.length },
    { label: "ກຳລັງມາ", value: count((s) => s.parcel_status === "in_transit") },
    { label: "ຮອດສາຂາ ຍັງບໍ່ແຈ້ງ", value: count((s) => s.parcel_status === "arrived"), tone: "text-blue-600" },
    { label: "ແຈ້ງລູກຄ້າແລ້ວ", value: count((s) => s.parcel_status === "notified"), tone: "text-green-600" },
    { label: "ລູກຄ້າຮັບແລ້ວ", value: count((s) => s.parcel_status === "picked_up") },
    { label: "ຂໍ້ຄວາມມື້ນີ້", value: today.length },
    {
      label: "ສົ່ງບໍ່ສຳເລັດມື້ນີ້",
      value: today.filter((l) => l.status === "failed" || l.status === "no_whatsapp").length,
      tone: "text-red-600",
    },
  ];

  // Branches worth showing: ones with staff, or with parcels still in play.
  const active = (branches ?? []).filter(
    (b) =>
      (users ?? []).some((u) => u.branch_id === b.id) ||
      all.some((s) => s.end_branch_id === b.id && s.parcel_status !== "delivered"),
  );

  return (
    <>
      <h1 className="text-xl font-semibold">ພາບລວມລະບົບ</h1>

      {sessions === null && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          ເຊື່ອມຕໍ່ OpenWA ບໍ່ໄດ້. ກວດ OPENWA_URL / OPENWA_API_KEY ໃນ .env.local ແລະ docker container openwa-api.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${c.tone ?? ""}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">ສາຂາ</h2>
          <Link href="/admin/branches" className="text-sm text-red-700 hover:underline dark:text-red-400">
            ຈັດການສາຂາ & ຜູ້ໃຊ້ →
          </Link>
        </div>
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            ຍັງບໍ່ມີສາຂາທີ່ໃຊ້ງານ. ໄປ <Link className="underline" href="/admin/branches">ສາຂາ & ຜູ້ໃຊ້</Link> ເພື່ອສ້າງບັນຊີສາຂາ.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="p-3">ສາຂາ</th>
                  <th className="p-3">WhatsApp</th>
                  <th className="p-3">Auto</th>
                  <th className="p-3 text-right">ກຳລັງມາ</th>
                  <th className="p-3 text-right">ຮອດ</th>
                  <th className="p-3 text-right">ແຈ້ງແລ້ວ</th>
                  <th className="p-3 text-right">ຮັບແລ້ວ</th>
                  <th className="p-3 text-right">ສົ່ງມື້ນີ້</th>
                  <th className="p-3 text-right">ລົ້ມເຫຼວ</th>
                  <th className="p-3 text-right">ຜູ້ໃຊ້</th>
                </tr>
              </thead>
              <tbody>
                {active.map((b) => {
                  const mine = all.filter((s) => s.end_branch_id === b.id);
                  const n = (p: string) => mine.filter((s) => s.parcel_status === p).length;
                  const msgs = today.filter((l) => l.branch_id === b.id);
                  const session = b.wa_session_id ? live.get(b.wa_session_id) : undefined;
                  const status = session?.status ?? (b.wa_session_id ? b.wa_status : "not_connected");
                  return (
                    <tr key={b.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="p-3">
                        <div className="font-medium">{b.name}</div>
                        <div className="text-xs text-zinc-500">{b.district ?? ""} · #{b.id}</div>
                      </td>
                      <td className="p-3">
                        <WaBadge status={status} />
                        {session?.phone && (
                          <div className="text-xs tabular-nums text-zinc-500">{formatLaoPhone(session.phone)}</div>
                        )}
                      </td>
                      <td className="p-3 text-xs">{b.auto_send ? "ເປີດ" : "ປິດ"}</td>
                      <td className="p-3 text-right tabular-nums">{n("in_transit")}</td>
                      <td className="p-3 text-right tabular-nums text-blue-600">{n("arrived")}</td>
                      <td className="p-3 text-right tabular-nums text-green-600">{n("notified")}</td>
                      <td className="p-3 text-right tabular-nums">{n("picked_up")}</td>
                      <td className="p-3 text-right tabular-nums">{msgs.length}</td>
                      <td className="p-3 text-right tabular-nums text-red-600">
                        {msgs.filter((l) => l.status === "failed" || l.status === "no_whatsapp").length}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {(users ?? []).filter((u) => u.branch_id === b.id).length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
