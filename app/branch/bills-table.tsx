"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { MessageBadge, ParcelBadge } from "@/components/badges";
import { formatDate, renderMessage, type MessageBranch } from "@/lib/message";
import { formatLaoPhone } from "@/lib/phone";
import type { MessageKind, Shipment } from "@/lib/types";
import {
  deleteDemoBills,
  generateBills,
  markPickedUp,
  receiveBills,
  refreshStatuses,
  sendBills,
  type GenerateState,
} from "./actions";

export type BillRow = Pick<
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
  | "arrived_at"
  | "is_demo"
  | "last_message_status"
  | "last_message_at"
  | "hal_created_at"
>;

const SENDABLE: Record<MessageKind, BillRow["parcel_status"][]> = {
  arrival: ["arrived", "notified"],
  reminder: ["notified"],
};

const kip = new Intl.NumberFormat("en-US");
const time = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Vientiane",
});

type Notice = { tone: "ok" | "error"; text: string } | null;

export function BillsTable({
  rows,
  branch,
  templates,
}: {
  rows: BillRow[];
  branch: MessageBranch & { wa_ready: boolean };
  templates: Record<string, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<Notice>(null);
  const [preview, setPreview] = useState<MessageKind | null>(null);
  const [pending, startTransition] = useTransition();
  const previewRef = useRef<HTMLDialogElement>(null);
  const generateRef = useRef<HTMLDialogElement>(null);

  const chosen = rows.filter((r) => selected.has(r.id));
  const allChecked = rows.length > 0 && chosen.length === rows.length;
  const sendable = (kind: MessageKind) =>
    chosen.filter((r) => SENDABLE[kind].includes(r.parcel_status));

  // Messages in flight (queued, or sent in the last 15 minutes): poll the
  // gateway for sent / delivered / read.
  useEffect(() => {
    const inFlight = rows.some(
      (r) =>
        r.last_message_status === "queued" ||
        (r.last_message_status === "sent" &&
          r.last_message_at &&
          Date.now() - Date.parse(r.last_message_at) < 15 * 60_000),
    );
    if (!inFlight) return;
    const t = setInterval(async () => {
      await refreshStatuses().catch(() => 0);
      router.refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [rows, router]);

  useEffect(() => {
    if (preview) previewRef.current?.showModal();
    else previewRef.current?.close();
  }, [preview]);

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function send(kind: MessageKind) {
    const ids = sendable(kind).map((r) => r.id);
    startTransition(async () => {
      const res = await sendBills(ids, kind);
      setPreview(null);
      if (res.error) {
        setNotice({ tone: "error", text: res.error });
      } else {
        setNotice({
          tone: "ok",
          text: `ເຂົ້າຄິວສົ່ງ ${res.queued} ຂໍ້ຄວາມ${
            res.skipped.length ? ` · ຂ້າມ ${res.skipped.length} ບິນ (ສະຖານະບໍ່ພ້ອມ)` : ""
          }. ລະບົບຈະສົ່ງເທື່ອລະຂໍ້ຄວາມ ຫ່າງກັນ 3–6 ວິນາທີ.`,
        });
        setSelected(new Set());
      }
      router.refresh();
    });
  }

  const incoming = chosen.filter((r) => r.parcel_status === "in_transit");

  function receive() {
    const ids = incoming.map((r) => r.id);
    startTransition(async () => {
      const res = await receiveBills(ids);
      if (res.error) {
        setNotice({ tone: "error", text: res.error });
      } else {
        const sent = res.sent
          ? res.sent.error
            ? ` · ສົ່ງ WhatsApp ບໍ່ໄດ້: ${res.sent.error}`
            : ` · ເຂົ້າຄິວສົ່ງ WhatsApp ${res.sent.queued} ຂໍ້ຄວາມ`
          : " · ກົດ “ສົ່ງແຈ້ງບິນ WhatsApp” ເພື່ອແຈ້ງລູກຄ້າ";
        setNotice({ tone: res.sent?.error ? "error" : "ok", text: `ຮັບເຂົ້າສາຂາ ${res.received} ບິນແລ້ວ${sent}` });
        if (!res.sent) setSelected(new Set(ids)); // keep them selected, ready to send
        else setSelected(new Set());
      }
      router.refresh();
    });
  }

  function pickedUp() {
    const ids = chosen.filter((r) => SENDABLE.arrival.includes(r.parcel_status)).map((r) => r.id);
    if (!ids.length) return setNotice({ tone: "error", text: "ເລືອກບິນທີ່ຮອດສາຂາແລ້ວກ່ອນ" });
    startTransition(async () => {
      const res = await markPickedUp(ids);
      setNotice(res.error ? { tone: "error", text: res.error } : { tone: "ok", text: `ໝາຍຮັບແລ້ວ ${ids.length} ບິນ` });
      setSelected(new Set());
      router.refresh();
    });
  }

  function removeDemo() {
    if (!confirm("ລຶບບິນ demo ທັງໝົດຂອງສາຂານີ້?")) return;
    startTransition(async () => {
      const res = await deleteDemoBills();
      setNotice(res.error ? { tone: "error", text: res.error } : { tone: "ok", text: "ລຶບບິນ demo ແລ້ວ" });
      setSelected(new Set());
      router.refresh();
    });
  }

  const previewRows = preview ? sendable(preview) : [];
  const previewText =
    preview && previewRows[0]
      ? renderMessage(templates[preview] ?? "", previewRows[0], branch)
      : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="px-2 text-sm text-zinc-500">ເລືອກ {chosen.length} ບິນ</span>
        {incoming.length > 0 && (
          <button
            disabled={pending}
            onClick={receive}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            ຮັບເຂົ້າສາຂາ ({incoming.length})
          </button>
        )}
        <button
          disabled={pending || sendable("arrival").length === 0}
          title={
            sendable("arrival").length === 0 && chosen.length > 0
              ? "ສົ່ງໄດ້ສະເພາະບິນທີ່ຮອດສາຂາແລ້ວ"
              : undefined
          }
          onClick={() => setPreview("arrival")}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
        >
          ສົ່ງແຈ້ງບິນ WhatsApp ({sendable("arrival").length})
        </button>
        <button
          disabled={pending || sendable("reminder").length === 0}
          onClick={() => setPreview("reminder")}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
        >
          ສົ່ງເຕືອນ ({sendable("reminder").length})
        </button>
        <button
          disabled={pending || chosen.length === 0}
          onClick={pickedUp}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
        >
          ລູກຄ້າຮັບແລ້ວ
        </button>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => generateRef.current?.showModal()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            + Generate ບິນ
          </button>
          <button
            onClick={removeDemo}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-red-600"
          >
            ລຶບບິນ demo
          </button>
        </div>
      </div>

      {incoming.length > 0 && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">
          {incoming.length} ບິນທີ່ເລືອກ ຍັງ “ກຳລັງມາ” (ຍັງບໍ່ໄດ້ສະແກນເຂົ້າສາຂາ), ຈຶ່ງສົ່ງ WhatsApp ບໍ່ໄດ້.
          ກົດ <b>ຮັບເຂົ້າສາຂາ</b> ກ່ອນ, ຫຼື ສະແກນທີ່ໜ້າ “ສະແກນເຄື່ອງເຂົ້າ”.
        </p>
      )}

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`rounded-md px-3 py-2 text-sm ${
            notice.tone === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
          }`}
        >
          {notice.text}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          ບໍ່ມີບິນໃນລາຍການນີ້. ກົດ <b>+ Generate ບິນ</b> ເພື່ອສ້າງບິນ demo.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    aria-label="ເລືອກທັງໝົດ"
                    checked={allChecked}
                    onChange={() =>
                      setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))
                    }
                    className="size-4 accent-red-600"
                  />
                </th>
                <th className="p-3">ເລກບິນ</th>
                <th className="p-3">ຜູ້ຮັບ</th>
                <th className="p-3">ນ້ຳໜັກ / ຂະໜາດ</th>
                <th className="p-3">ເກັບເງິນ</th>
                <th className="p-3">ສະຖານະ</th>
                <th className="p-3">WhatsApp</th>
                <th className="p-3">ຮັບກ່ອນ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`cursor-pointer border-t border-zinc-100 dark:border-zinc-800 ${
                    selected.has(r.id) ? "bg-red-50/60 dark:bg-red-950/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={r.shipment_number}
                      className="size-4 accent-red-600"
                    />
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {r.shipment_number}
                    {r.is_demo && (
                      <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        demo
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div>{r.receiver_name ?? "—"}</div>
                    <div className="text-xs text-zinc-500 tabular-nums">{formatLaoPhone(r.receiver_phone)}</div>
                  </td>
                  <td className="p-3 tabular-nums">
                    {r.weight_kg ?? "—"} kg · {r.size_cm ?? "—"} cm
                  </td>
                  <td className="p-3 text-xs tabular-nums">
                    {r.cod_amount ? (
                      <span className="font-medium text-orange-700 dark:text-orange-400">
                        COD {kip.format(r.cod_amount)}
                      </span>
                    ) : r.shipment_pay_type?.startsWith("destination") ? (
                      <span>ປາຍທາງ {kip.format(r.total_freight ?? 0)}</span>
                    ) : (
                      <span className="text-zinc-400">ຈ່າຍແລ້ວ</span>
                    )}
                  </td>
                  <td className="p-3">
                    <ParcelBadge status={r.parcel_status} />
                    {r.arrived_at && (
                      <div className="mt-0.5 text-[11px] text-zinc-400">{time.format(new Date(r.arrived_at))}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <MessageBadge status={r.last_message_status} />
                  </td>
                  <td className="p-3 text-xs tabular-nums">{formatDate(r.pickup_deadline) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dialog
        ref={previewRef}
        onClose={() => setPreview(null)}
        className="m-auto w-[min(92vw,30rem)] rounded-xl p-0 text-inherit dark:bg-zinc-900"
      >
        <div className="flex flex-col gap-3 p-5">
          <h2 className="text-lg font-semibold">
            {preview === "reminder" ? "ສົ່ງຂໍ້ຄວາມເຕືອນ" : "ສົ່ງແຈ້ງບິນ"} {previewRows.length} ບິນ
          </h2>
          {!branch.wa_ready && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              WhatsApp ຍັງບໍ່ໄດ້ເຊື່ອມ, ການສົ່ງຈະບໍ່ສຳເລັດ.
            </p>
          )}
          {chosen.length > previewRows.length && (
            <p className="text-sm text-zinc-500">
              ຂ້າມ {chosen.length - previewRows.length} ບິນທີ່ຍັງບໍ່ຮອດສາຂາ ຫຼື ຮັບແລ້ວ.
            </p>
          )}
          <p className="text-xs text-zinc-500">ຕົວຢ່າງຂໍ້ຄວາມ (ບິນ {previewRows[0]?.shipment_number}):</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-[#dcf8c6] p-3 font-sans text-sm text-zinc-900">
            {previewText}
          </pre>
          <p className="text-xs text-zinc-500">
            ໃຊ້ເວລາປະມານ {Math.ceil((previewRows.length * 4.5) / 60)} ນາທີ (ສົ່ງຫ່າງກັນ 3–6 ວິນາທີ ເພື່ອບໍ່ໃຫ້ເບີຖືກບລັອກ).
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setPreview(null)} className="rounded-md px-3 py-1.5 text-sm">
              ຍົກເລີກ
            </button>
            <button
              disabled={pending || previewRows.length === 0}
              onClick={() => preview && send(preview)}
              className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "ກຳລັງສົ່ງ…" : "ຢືນຢັນສົ່ງ"}
            </button>
          </div>
        </div>
      </dialog>

      <GenerateDialog dialogRef={generateRef} onDone={() => router.refresh()} />
    </div>
  );
}

function GenerateDialog({
  dialogRef,
  onDone,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<GenerateState, FormData>(
    async (prev, form) => {
      const res = await generateBills(prev, form);
      if (res.ok) onDone();
      return res;
    },
    {},
  );

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(92vw,26rem)] rounded-xl p-0 text-inherit dark:bg-zinc-900"
    >
      <form action={action} className="flex flex-col gap-3 p-5">
        <h2 className="text-lg font-semibold">Generate ບິນ demo</h2>
        <p className="text-sm text-zinc-500">
          ສ້າງບິນທີ່ກຳລັງມາສາຂານີ້ (ສະຖານະ “ກຳລັງມາ”). ຈາກນັ້ນໄປໜ້າສະແກນ ເພື່ອຮັບເຂົ້າສາຂາ.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          ຈຳນວນບິນ
          <input
            name="count"
            type="number"
            min={1}
            max={50}
            defaultValue={5}
            required
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          ເບີ WhatsApp ຜູ້ຮັບ (ຫຼາຍເບີ ຂັ້ນດ້ວຍຈຸດ ,)
          <textarea
            name="phones"
            required
            rows={2}
            placeholder="02078331163, 02097364057"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-950"
          />
          <span className="text-xs text-zinc-500">
            ຂໍ້ຄວາມຈະຖືກສົ່ງໄປເບີເຫຼົ່ານີ້ແທ້, ໃຊ້ເບີທີ່ທ່ານທົດສອບໄດ້.
          </span>
        </label>
        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-md px-3 py-1.5 text-sm">
            ປິດ
          </button>
          <button
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "ກຳລັງສ້າງ…" : "ສ້າງບິນ"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
