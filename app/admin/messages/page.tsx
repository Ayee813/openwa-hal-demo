import type { Metadata } from "next";
import { Suspense } from "react";
import { MESSAGE_LABEL, MessageBadge } from "@/components/badges";
import { requireProfile } from "@/lib/auth";
import { formatLaoPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import type { MessageStatus } from "@/lib/types";
import { Filters } from "../filters";

export const metadata: Metadata = { title: "ປະຫວັດຂໍ້ຄວາມ" };

const time = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Vientiane",
});

export default function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  return (
    <Suspense fallback={<p className="text-zinc-500">ກຳລັງໂຫຼດ…</p>}>
      <Messages searchParams={searchParams} />
    </Suspense>
  );
}

async function Messages({ searchParams }: Pick<PageProps<"/admin/messages">, "searchParams">) {
  await requireProfile("admin");
  const params = await searchParams;
  const branch = typeof params.branch === "string" ? params.branch : "";
  const status = typeof params.status === "string" ? params.status : "";

  const supabase = await createClient();
  let query = supabase
    .from("message_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (branch) query = query.eq("branch_id", Number(branch));
  if (status) query = query.eq("status", status as MessageStatus);

  const [{ data: logs, error }, { data: branches }, { data: shipments }, { data: users }] =
    await Promise.all([
      query,
      supabase.from("branches").select("id, name").order("name"),
      supabase.from("shipments").select("id, shipment_number").not("last_message_status", "is", null),
      supabase.from("profiles").select("id, full_name"),
    ]);

  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const number = new Map((shipments ?? []).map((s) => [s.id, s.shipment_number]));
  const userName = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  return (
    <>
      <h1 className="text-xl font-semibold">ປະຫວັດຂໍ້ຄວາມ WhatsApp</h1>
      <Filters
        action="/admin/messages"
        fields={[
          {
            name: "branch",
            label: "ສາຂາ",
            value: branch,
            options: [["", "ທຸກສາຂາ"], ...(branches ?? []).map((b): [string, string] => [String(b.id), b.name])],
          },
          {
            name: "status",
            label: "ສະຖານະ",
            value: status,
            options: [["", "ທຸກສະຖານະ"], ...Object.entries(MESSAGE_LABEL)],
          },
        ]}
      />
      {error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : !logs?.length ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          ຍັງບໍ່ມີຂໍ້ຄວາມ
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="p-3">ເວລາ</th>
                <th className="p-3">ສາຂາ</th>
                <th className="p-3">ບິນ</th>
                <th className="p-3">ເບີ</th>
                <th className="p-3">ປະເພດ</th>
                <th className="p-3">ສະຖານະ</th>
                <th className="p-3">ຂໍ້ຄວາມ</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                  <td className="p-3 text-xs tabular-nums">{time.format(new Date(l.created_at))}</td>
                  <td className="p-3">
                    {branchName.get(l.branch_id) ?? `#${l.branch_id}`}
                    <div className="text-xs text-zinc-500">{l.sent_by ? userName.get(l.sent_by) : ""}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{number.get(l.shipment_id) ?? l.shipment_id}</td>
                  <td className="p-3 text-xs tabular-nums">{formatLaoPhone(l.phone)}</td>
                  <td className="p-3 text-xs">{l.kind === "reminder" ? "ເຕືອນ" : "ແຈ້ງຮອດ"}</td>
                  <td className="p-3">
                    <MessageBadge status={l.status} />
                    {l.error && <div className="mt-1 max-w-48 text-xs text-red-600">{l.error}</div>}
                  </td>
                  <td className="p-3">
                    <details>
                      <summary className="cursor-pointer text-xs text-zinc-500">ເບິ່ງ</summary>
                      <pre className="mt-1 max-w-sm whitespace-pre-wrap rounded bg-[#dcf8c6] p-2 font-sans text-xs text-zinc-900">
                        {l.body}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
