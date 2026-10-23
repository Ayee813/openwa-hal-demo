"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { WaBadge } from "@/components/badges";
import { alert, btn, card, cardHead, hint } from "@/components/ui";
import { formatLaoPhone } from "@/lib/phone";
import { connectWhatsApp, logoutWhatsApp, whatsappState, type WaState } from "../actions";

const SETTLED = ["ready", "not_connected", "disconnected", "failed", "action_required"];

const STEPS = [
  "ເປີດ WhatsApp ໃນໂທລະສັບຂອງສາຂາ",
  "ເມນູ ⋮ → ອຸປະກອນທີ່ເຊື່ອມ (Linked devices) → ເຊື່ອມອຸປະກອນ",
  "ສະແກນ QR ທີ່ສະແດງຢູ່ນີ້",
];

export function WhatsAppPanel({ initialStatus }: { initialStatus: string }) {
  const router = useRouter();
  const [state, setState] = useState<WaState>({ status: initialStatus as WaState["status"] });
  const [pending, startTransition] = useTransition();

  const apply = useCallback((next: WaState) => setState(next), []);

  // Refresh the server-rendered header badge when the status changes. Done in
  // an effect: calling router.refresh() inside a setState updater updates the
  // Router while this component renders.
  const shownStatus = useRef(initialStatus);
  useEffect(() => {
    if (state.status === shownStatus.current) return;
    shownStatus.current = state.status;
    router.refresh();
  }, [state.status, router]);

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
  const settled = SETTLED.includes(state.status);

  const connect = () => startTransition(async () => apply(await connectWhatsApp()));
  const logout = () => {
    if (!confirm("ຕັດການເຊື່ອມ WhatsApp ຂອງສາຂາ?")) return;
    startTransition(async () => apply(await logoutWhatsApp()));
  };

  return (
    <section className={card}>
      <div className={cardHead}>
        <h2 className="font-semibold">ການເຊື່ອມຕໍ່</h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1">
          <WaBadge status={state.status} />
        </span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {connected ? (
          <div className="flex items-center gap-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-wa text-white">
              <WaIcon className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{state.name ?? "WhatsApp"}</p>
              <p className="text-sm tabular-nums text-zinc-600">{formatLaoPhone(state.phone)}</p>
              <p className="mt-0.5 text-xs text-wa-text">ພ້ອມສົ່ງຂໍ້ຄວາມແຈ້ງບິນ</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <QrBox qr={state.qr} loading={!settled || pending} />
            <div className="flex flex-col gap-3">
              <ol className="flex flex-col gap-2.5">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex gap-3 text-sm text-zinc-700">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-hal-soft text-xs font-semibold text-hal">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
              <p className={hint}>
                {state.qr
                  ? "QR ປ່ຽນໃໝ່ທຸກໆ ~20 ວິນາທີ, ໜ້ານີ້ອັບເດດເອງ."
                  : settled
                    ? "ກົດ ເຊື່ອມ WhatsApp ເພື່ອສະແດງ QR."
                    : "ກຳລັງກຽມ QR… ອາດໃຊ້ເວລາ 10–30 ວິນາທີ."}
              </p>
            </div>
          </div>
        )}

        {state.error && (
          <p role="alert" className={alert.error}>
            {state.error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
        {connected && (
          <Link href="/bills" className={`${btn.wa} mr-auto`}>
            ໄປສົ່ງແຈ້ງບິນ →
          </Link>
        )}
        {state.status !== "not_connected" && (
          <button disabled={pending} onClick={logout} className={btn.outline}>
            ຕັດການເຊື່ອມ
          </button>
        )}
        {!connected && settled && (
          <button disabled={pending} onClick={connect} className={btn.wa}>
            <WaIcon className="size-4" />
            {pending ? "ກຳລັງເຊື່ອມ…" : "ເຊື່ອມ WhatsApp"}
          </button>
        )}
      </div>
    </section>
  );
}

function QrBox({ qr, loading }: { qr?: string; loading: boolean }) {
  return (
    <div className="mx-auto grid size-56 shrink-0 place-items-center rounded-lg border-2 border-dashed border-zinc-200 bg-head">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- data: URL from the gateway
        <img src={qr} alt="WhatsApp QR" className="size-52 rounded bg-white p-1.5" />
      ) : loading ? (
        <span className="size-8 animate-spin rounded-full border-2 border-zinc-300 border-t-wa" aria-label="ກຳລັງໂຫຼດ" />
      ) : (
        <QrIcon />
      )}
    </div>
  );
}

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5Z" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="size-14 text-zinc-300">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
    </svg>
  );
}
