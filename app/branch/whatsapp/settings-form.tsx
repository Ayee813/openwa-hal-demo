"use client";

import { useActionState } from "react";
import { updateBranchSettings, type SettingsState } from "../actions";

export function SettingsForm({
  branch,
}: {
  branch: {
    staff_phone: string;
    pickup_days: number;
    auto_send: boolean;
    daily_limit: number;
    tel: string | null;
  };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateBranchSettings,
    {},
  );

  const input =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="font-medium">ຕັ້ງຄ່າການແຈ້ງບິນ</h2>

      <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <input
          type="checkbox"
          name="auto_send"
          defaultChecked={branch.auto_send}
          className="mt-1 size-5 accent-green-600"
        />
        <span className="text-sm">
          <b>ສົ່ງ WhatsApp ອັດຕະໂນມັດ ເມື່ອສະແກນເຄື່ອງເຂົ້າສາຂາ</b>
          <br />
          <span className="text-zinc-500">
            ປິດ = ສະແກນແລ້ວໄປເລືອກບິນ ແລະ ກົດສົ່ງເອງໃນໜ້າລາຍການບິນ.
          </span>
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        ເບີໂທພະນັກງານຮັບເຄື່ອງ (ສະແດງໃນຂໍ້ຄວາມ)
        <input
          name="staff_phone"
          defaultValue={branch.staff_phone}
          placeholder="02078331163"
          className={`${input} font-mono`}
        />
        <span className="text-xs text-zinc-500">
          ຖ້າບໍ່ໃສ່ ຈະໃຊ້ເບີໂທສາຂາ ({branch.tel ?? "—"})
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        ໃຫ້ລູກຄ້າເຂົ້າຮັບພາຍໃນ (ວັນ ຫຼັງຮອດສາຂາ)
        <input
          name="pickup_days"
          type="number"
          min={1}
          max={60}
          defaultValue={branch.pickup_days}
          className={`${input} w-32`}
        />
      </label>

      <p className="text-xs text-zinc-500">
        ເພດານສົ່ງຕໍ່ວັນ: {branch.daily_limit} ຂໍ້ຄວາມ (Admin ປ່ຽນໄດ້)
      </p>

      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}

      <button
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "ກຳລັງບັນທຶກ…" : "ບັນທຶກ"}
      </button>
    </form>
  );
}
