"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { generateBills, resetDemo, type DemoState } from "../actions";

const PHONES_KEY = "demo-phones";

/** Mock-bill tools of the development account: generate and clear. */
export function DemoTools({ date }: { date: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, generating] = useActionState(generateBills, {} as DemoState);
  const [resetState, setResetState] = useState<DemoState>({});
  const [resetting, startReset] = useTransition();
  const phonesRef = useRef<HTMLInputElement>(null);

  // The numbers typed last time, so they needn't be typed again.
  useEffect(() => {
    try {
      if (phonesRef.current) phonesRef.current.value = localStorage.getItem(PHONES_KEY) ?? "";
    } catch {}
  }, []);

  useEffect(() => {
    if (state.ok) dialogRef.current?.close();
  }, [state]);

  function reset() {
    if (!confirm("ລຶບບິນທົດລອງ ແລະ ປະຫວັດການສົ່ງທັງໝົດ?")) return;
    startReset(async () => setResetState(await resetDemo()));
  }

  const note = resetState.ok ?? resetState.error ?? state.ok;
  const input =
    "h-9 w-full rounded border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-hal focus:ring-2 focus:ring-hal/15";

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">DEV · ຂໍ້ມູນທົດລອງ</span>
      {note && <span className="text-xs text-zinc-500">{note}</span>}
      <button
        onClick={() => dialogRef.current?.showModal()}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
      >
        + Generate ບິນ
      </button>
      <button
        onClick={reset}
        disabled={resetting}
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:border-hal hover:text-hal disabled:opacity-50"
      >
        {resetting ? "ກຳລັງລຶບ…" : "ລຶບຂໍ້ມູນທົດລອງ"}
      </button>

      <dialog ref={dialogRef} className="m-auto w-[min(92vw,28rem)] rounded-lg p-0">
        <form action={action} className="flex flex-col gap-3 p-5">
          <h2 className="text-lg font-semibold">Generate ບິນທົດລອງ</h2>
          <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ຂໍ້ຄວາມຈະຖືກສົ່ງ WhatsApp ແທ້ຫາເບີທີ່ໃສ່ນີ້. ໃຊ້ສະເພາະເບີຂອງທ່ານເອງ.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            ຈຳນວນບິນ (1–50):
            <input name="count" type="number" min={1} max={50} defaultValue={5} required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ເບີຜູ້ຮັບ (ຫຼາຍເບີຂັ້ນດ້ວຍຈຸດ):
            <input
              ref={phonesRef}
              name="phones"
              onChange={(e) => {
                try {
                  localStorage.setItem(PHONES_KEY, e.target.value);
                } catch {}
              }}
              placeholder="020 xxxx xxxx, 020 yyyy yyyy"
              required
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ວັນທີຮອດສາຂາ:
            <input name="date" type="date" defaultValue={date} required className={input} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="includeBad" type="checkbox" className="size-4 accent-hal" />
            ໃສ່ເບີຜິດປົນ (030, 7 ໂຕ, ***, ບໍ່ມີເບີ) ເພື່ອທົດສອບແຖບ ສົ່ງບໍ່ໄດ້
          </label>
          {state.error && <p className="text-sm text-hal">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded border border-zinc-300 px-4 py-1.5 text-sm"
            >
              ຍົກເລີກ
            </button>
            <button
              disabled={generating}
              className="rounded bg-hal px-4 py-1.5 text-sm font-medium text-white hover:bg-hal-dark disabled:opacity-50"
            >
              {generating ? "ກຳລັງສ້າງ…" : "ສ້າງບິນ"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
