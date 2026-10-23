"use client";

import { useActionState } from "react";
import { alert, btn, card, cardHead, field, hint } from "@/components/ui";
import { updateBranchSettings, type SettingsState } from "../actions";

export function SettingsForm({
  branch,
}: {
  branch: { staff_phone: string; pickup_days: number; daily_limit: number; tel: string | null };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateBranchSettings, {});

  return (
    <form action={action} className={card}>
      <div className={cardHead}>
        <h2 className="font-semibold">ຕັ້ງຄ່າການແຈ້ງບິນ</h2>
      </div>

      <div className="flex flex-col gap-5 p-5">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">ເບີໂທສາຂາປາຍທາງ</span>
          <input
            name="staff_phone"
            defaultValue={branch.staff_phone}
            placeholder="02052415523, 02054656540"
            inputMode="tel"
            className={`${field} tabular-nums`}
          />
          <span className={hint}>
            ສະແດງໃນຂໍ້ຄວາມ, ໃສ່ໄດ້ສູງສຸດ 4 ເບີ ຂັ້ນດ້ວຍຈຸດ. ຖ້າບໍ່ໃສ່ ຈະໃຊ້ເບີໂທສາຂາ ({branch.tel ?? "—"}).
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">ໃຫ້ລູກຄ້າເຂົ້າຮັບພາຍໃນ</span>
          <span className="flex w-40 items-center">
            <input
              name="pickup_days"
              type="number"
              min={1}
              max={60}
              defaultValue={branch.pickup_days}
              className={`${field} rounded-r-none`}
            />
            <span className="flex h-9 items-center rounded-r border border-l-0 border-zinc-300 bg-head px-3 text-zinc-500">
              ວັນ
            </span>
          </span>
          <span className={hint}>ນັບຈາກວັນທີເຄື່ອງຮອດສາຂາ.</span>
        </label>

        <div className="flex items-center justify-between rounded bg-head px-3 py-2 text-sm">
          <span className="text-zinc-500">ເພດານສົ່ງຕໍ່ວັນ</span>
          <span className="font-medium tabular-nums">{branch.daily_limit} ຂໍ້ຄວາມ</span>
        </div>

        {state.error && (
          <p role="alert" className={alert.error}>
            {state.error}
          </p>
        )}
        {state.ok && <p className={alert.ok}>{state.ok}</p>}
      </div>

      <div className="flex justify-end border-t border-line px-5 py-3">
        <button disabled={pending} className={btn.primary}>
          {pending ? "ກຳລັງບັນທຶກ…" : "ບັນທຶກ"}
        </button>
      </div>
    </form>
  );
}
