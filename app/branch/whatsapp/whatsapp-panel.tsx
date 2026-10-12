"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { WaBadge } from "@/components/badges";
import { formatLaoPhone } from "@/lib/phone";
import { connectWhatsApp, logoutWhatsApp, whatsappState, type WaState } from "../actions";

const SETTLED = ["ready", "not_connected", "disconnected", "failed", "action_required"];

export function WhatsAppPanel({ initialStatus }: { initialStatus: string }) {
  const router = useRouter();
  const [state, setState] = useState<WaState>({ status: initialStatus as WaState["status"] });
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (next: WaState) => {
      setState((prev) => {
        if (prev.status !== next.status) router.refresh(); // header badge
        return next;
      });
    },
    [router],
  );

  // Live status on load, then every 3 s while a QR is up or the session starts.
  useEffect(() => {
    whatsappState().then(apply);
  }, [apply]);

  useEffect(() => {
    if (SETTLED.includes(state.status)) return;
    const t = setInterval(() => whatsappState().then(apply), 3000);
    return () => clearInterval(t);
  }, [state.status, apply]);

  const connected = state.status === "ready";

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">ການເຊື່ອມຕໍ່</h2>
        <WaBadge status={state.status} />
      </div>

      {connected ? (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
          <span className="grid size-10 place-items-center rounded-full bg-green-500 text-xl text-white">✓</span>
          <div>
            <p className="font-medium">{state.name ?? "WhatsApp"}</p>
            <p className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
              {formatLaoPhone(state.phone)}
            </p>
          </div>
        </div>
      ) : state.qr ? (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from the gateway */}
          <img src={state.qr} alt="WhatsApp QR" className="size-64 rounded-lg bg-white p-2" />
          <ol className="list-decimal pl-5 text-sm text-zinc-600 dark:text-zinc-300">
            <li>ເປີດ WhatsApp ໃນໂທລະສັບຂອງສາຂາ</li>
            <li>ເມນູ ⋮ → ອຸປະກອນທີ່ເຊື່ອມ (Linked devices) → ເຊື່ອມອຸປະກອນ</li>
            <li>ສະແກນ QR ນີ້ (QR ປ່ຽນໃໝ່ທຸກໆ ~20 ວິນາທີ)</li>
          </ol>
        </div>
      ) : SETTLED.includes(state.status) ? (
        <p className="text-sm text-zinc-500">
          ກົດ “ເຊື່ອມ WhatsApp” ເພື່ອສະແດງ QR ແລ້ວສະແກນດ້ວຍໂທລະສັບຂອງສາຂາ.
        </p>
      ) : (
        <p className="text-sm text-zinc-500">ກຳລັງກຽມ QR… (ອາດໃຊ້ເວລາ 10–30 ວິນາທີ)</p>
      )}

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        {!connected && (
          <button
            disabled={pending}
            onClick={() => startTransition(async () => apply(await connectWhatsApp()))}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {pending ? "ກຳລັງເຊື່ອມ…" : "ເຊື່ອມ WhatsApp"}
          </button>
        )}
        {state.status !== "not_connected" && (
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm("ຕັດການເຊື່ອມ WhatsApp ຂອງສາຂາ?")) return;
              startTransition(async () => apply(await logoutWhatsApp()));
            }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm disabled:opacity-60 dark:border-zinc-700"
          >
            ຕັດການເຊື່ອມ
          </button>
        )}
      </div>
    </section>
  );
}
