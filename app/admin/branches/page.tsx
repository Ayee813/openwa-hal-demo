import type { Metadata } from "next";
import { Suspense } from "react";
import { WaBadge } from "@/components/badges";
import { requireProfile } from "@/lib/auth";
import { openwa, type WaSession } from "@/lib/openwa";
import { createClient } from "@/lib/supabase/server";
import { BranchForm, UserForm, UserToggle } from "./forms";

export const metadata: Metadata = { title: "ສາຂາ & ຜູ້ໃຊ້" };

export default function BranchesPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">ກຳລັງໂຫຼດ…</p>}>
      <Branches />
    </Suspense>
  );
}

async function Branches() {
  const me = await requireProfile("admin");
  const supabase = await createClient();

  const [{ data: branches }, { data: users }, { data: shipments }, sessions] = await Promise.all([
    supabase.from("branches").select("*").order("name"),
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("shipments").select("end_branch_id"),
    openwa.listSessions().catch(() => [] as WaSession[]),
  ]);

  const parcels = new Map<number, number>();
  for (const s of shipments ?? []) {
    if (s.end_branch_id) parcels.set(s.end_branch_id, (parcels.get(s.end_branch_id) ?? 0) + 1);
  }
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const sessionOptions = sessions.map((s) => ({
    id: s.id,
    label: `${s.name}${s.phone ? ` · ${s.phone}` : ""} (${s.status})`,
  }));
  const branchOptions = (branches ?? []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <>
      <h1 className="text-xl font-semibold">ສາຂາ & ຜູ້ໃຊ້</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium">ສ້າງບັນຊີຜູ້ໃຊ້</h2>
          <UserForm branches={branchOptions} />
        </section>
        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium">ເພີ່ມສາຂາໃໝ່</h2>
          <p className="text-xs text-zinc-500">
            ສາຂາຖືກສ້າງອັດຕະໂນມັດເມື່ອນຳເຂົ້າບິນ HAL. ໃຊ້ຟອມນີ້ສຳລັບສາຂາທີ່ຍັງບໍ່ມີ (ໃຊ້ HAL branch id).
          </p>
          <BranchForm sessions={sessionOptions} />
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">ຜູ້ໃຊ້ ({users?.length ?? 0})</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="p-3">ຊື່</th>
                <th className="p-3">ອີເມວ</th>
                <th className="p-3">Role</th>
                <th className="p-3">ສາຂາ</th>
                <th className="p-3">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="p-3">{u.full_name}</td>
                  <td className="p-3 text-xs">{u.email}</td>
                  <td className="p-3 text-xs">{u.role}</td>
                  <td className="p-3">{u.branch_id ? branchName.get(u.branch_id) ?? `#${u.branch_id}` : "—"}</td>
                  <td className="p-3">
                    <UserToggle id={u.id} active={u.is_active} self={u.id === me.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">ສາຂາ ({branches?.length ?? 0})</h2>
        <div className="flex flex-col gap-2">
          {(branches ?? []).map((b) => (
            <details
              key={b.id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
                <span className="font-medium">{b.name}</span>
                <span className="text-xs text-zinc-500">
                  #{b.id} · {b.district ?? "—"} · {parcels.get(b.id) ?? 0} ບິນ ·{" "}
                  {(users ?? []).filter((u) => u.branch_id === b.id).length} ຜູ້ໃຊ້
                </span>
                <span className="ml-auto">
                  <WaBadge status={b.wa_session_id ? b.wa_status : "not_connected"} />
                </span>
              </summary>
              <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
                <BranchForm
                  sessions={sessionOptions}
                  branch={{
                    id: b.id,
                    name: b.name,
                    tel: b.tel ?? "",
                    district: b.district ?? "",
                    staff_phone: b.staff_phone ?? "",
                    pickup_days: b.pickup_days,
                    daily_limit: b.daily_limit,
                    auto_send: b.auto_send,
                    wa_session_id: b.wa_session_id ?? "",
                  }}
                />
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
