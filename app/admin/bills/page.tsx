import type { Metadata } from "next";
import { Suspense } from "react";
import { MessageBadge, PARCEL_LABEL, ParcelBadge } from "@/components/badges";
import { requireProfile } from "@/lib/auth";
import { formatDate } from "@/lib/message";
import { formatLaoPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import type { ParcelStatus } from "@/lib/types";
import { Filters } from "../filters";
import { ImportForm } from "../import-form";

export const metadata: Metadata = { title: "ບິນທັງໝົດ" };

const kip = new Intl.NumberFormat("en-US");

export default function AdminBillsPage({ searchParams }: PageProps<"/admin/bills">) {
  return (
    <Suspense fallback={<p className="text-zinc-500">ກຳລັງໂຫຼດ…</p>}>
      <Bills searchParams={searchParams} />
    </Suspense>
  );
}

async function Bills({ searchParams }: Pick<PageProps<"/admin/bills">, "searchParams">) {
  await requireProfile("admin");
  const params = await searchParams;
  const branch = typeof params.branch === "string" ? params.branch : "";
  const status = typeof params.status === "string" ? params.status : "";

  const supabase = await createClient();
  let query = supabase
    .from("shipments")
    .select(
      "id, shipment_number, receiver_name, receiver_phone, sender_name, end_branch_id, parcel_status, last_message_status, total_freight, cod_amount, pickup_deadline, is_demo, hal_created_at",
      { count: "exact" },
    )
    .order("hal_created_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (branch) query = query.eq("end_branch_id", Number(branch));
  if (status) query = query.eq("parcel_status", status as ParcelStatus);

  const [{ data: rows, count, error }, { data: branches }] = await Promise.all([
    query,
    supabase.from("branches").select("id, name").order("name"),
  ]);
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  return (
    <>
      <h1 className="text-xl font-semibold">ບິນທັງໝົດ</h1>

      <section className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="font-medium">ນຳເຂົ້າຈາກ HAL API</h2>
        <p className="text-sm text-zinc-500">
          ເລືອກໄຟລ໌ໃນ <code>data/</code> (response ຂອງ HAL API). ບິນທີ່ HAL ສົ່ງສຳເລັດແລ້ວ ຈະຖືກໝາຍ “ສຳເລັດ (HAL)” ແລະ ຈະບໍ່ຖືກສົ່ງແຈ້ງ.
        </p>
        <ImportForm />
      </section>

      <Filters
        action="/admin/bills"
        fields={[
          {
            name: "branch",
            label: "ສາຂາປາຍທາງ",
            value: branch,
            options: [["", "ທຸກສາຂາ"], ...(branches ?? []).map((b): [string, string] => [String(b.id), b.name])],
          },
          {
            name: "status",
            label: "ສະຖານະ",
            value: status,
            options: [["", "ທຸກສະຖານະ"], ...Object.entries(PARCEL_LABEL)],
          },
        ]}
      />

      {error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <p className="px-3 pt-3 text-xs text-zinc-500">ສະແດງ {rows?.length ?? 0} ຈາກ {count ?? 0} ບິນ</p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="p-3">ເລກບິນ</th>
                <th className="p-3">ຜູ້ສົ່ງ → ຜູ້ຮັບ</th>
                <th className="p-3">ສາຂາປາຍທາງ</th>
                <th className="p-3 text-right">ຄ່າສົ່ງ / COD</th>
                <th className="p-3">ສະຖານະ</th>
                <th className="p-3">WhatsApp</th>
                <th className="p-3">ຮັບກ່ອນ</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((s) => (
                <tr key={s.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="p-3 font-mono text-xs">
                    {s.shipment_number}
                    {s.is_demo && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700">demo</span>}
                  </td>
                  <td className="p-3">
                    {s.sender_name ?? "—"} → {s.receiver_name ?? "—"}
                    <div className="text-xs tabular-nums text-zinc-500">{formatLaoPhone(s.receiver_phone)}</div>
                  </td>
                  <td className="p-3">{s.end_branch_id ? branchName.get(s.end_branch_id) ?? `#${s.end_branch_id}` : "—"}</td>
                  <td className="p-3 text-right tabular-nums">
                    {kip.format(s.total_freight ?? 0)}
                    {s.cod_amount ? <div className="text-xs text-orange-600">COD {kip.format(s.cod_amount)}</div> : null}
                  </td>
                  <td className="p-3"><ParcelBadge status={s.parcel_status} /></td>
                  <td className="p-3"><MessageBadge status={s.last_message_status} /></td>
                  <td className="p-3 text-xs tabular-nums">{formatDate(s.pickup_deadline) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
