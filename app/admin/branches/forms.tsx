"use client";

import { useActionState, useState, useTransition } from "react";
import { createUser, saveBranch, setUserActive, type FormState } from "../actions";

const input =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function Result({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="text-sm text-red-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-green-700">{state.ok}</p>;
  return null;
}

export function UserForm({ branches }: { branches: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, {});
  const [role, setRole] = useState("branch");

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        ຊື່
        <input name="full_name" required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ອີເມວ
        <input name="email" type="email" required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ລະຫັດຜ່ານ (≥ 8)
        <input name="password" type="password" minLength={8} required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Role
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className={input}>
          <option value="branch">branch (ພະນັກງານສາຂາ)</option>
          <option value="admin">admin</option>
        </select>
      </label>
      {role === "branch" && (
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          ສາຂາ
          <select name="branch_id" required className={input} defaultValue="">
            <option value="" disabled>
              ເລືອກສາຂາ…
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (#{b.id})
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "ກຳລັງສ້າງ…" : "ສ້າງບັນຊີ"}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

type BranchValues = {
  id: number;
  name: string;
  tel: string;
  district: string;
  staff_phone: string;
  pickup_days: number;
  daily_limit: number;
  auto_send: boolean;
  wa_session_id: string;
};

export function BranchForm({
  branch,
  sessions,
}: {
  branch?: BranchValues;
  sessions: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBranch, {});
  const known = sessions.some((s) => s.id === branch?.wa_session_id);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      {branch ? (
        <input type="hidden" name="id" value={branch.id} />
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          HAL branch id
          <input name="id" type="number" min={1} required className={input} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        ຊື່ສາຂາ
        <input name="name" defaultValue={branch?.name} required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ເມືອງ
        <input name="district" defaultValue={branch?.district} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ເບີໂທສາຂາ
        <input name="tel" defaultValue={branch?.tel} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ເບີພະນັກງານ
        <input name="staff_phone" defaultValue={branch?.staff_phone} placeholder="020…" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ມື້ໃຫ້ມາຮັບ
        <input name="pickup_days" type="number" min={1} max={60} defaultValue={branch?.pickup_days ?? 7} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ເພດານສົ່ງ/ວັນ
        <input name="daily_limit" type="number" min={1} max={2000} defaultValue={branch?.daily_limit ?? 200} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Session WhatsApp (OpenWA)
        <select name="wa_session_id" defaultValue={branch?.wa_session_id ?? ""} className={input}>
          <option value="">— ບໍ່ຜູກ (ສາຂາເຊື່ອມເອງດ້ວຍ QR) —</option>
          {branch?.wa_session_id && !known && (
            <option value={branch.wa_session_id}>{branch.wa_session_id} (ບໍ່ພົບໃນ OpenWA)</option>
          )}
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="auto_send" defaultChecked={branch?.auto_send} className="size-4 accent-green-600" />
        ສົ່ງອັດຕະໂນມັດເມື່ອສະແກນ
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "ກຳລັງບັນທຶກ…" : branch ? "ບັນທຶກ" : "ເພີ່ມສາຂາ"}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function UserToggle({ id, active, self }: { id: string; active: boolean; self: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <span className="flex items-center gap-2">
      <span className={`text-xs ${active ? "text-green-700" : "text-zinc-400"}`}>
        {active ? "ໃຊ້ງານ" : "ປິດ"}
      </span>
      {!self && (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => setError((await setUserActive(id, !active)).error))
          }
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-60 dark:border-zinc-700"
        >
          {active ? "ປິດບັນຊີ" : "ເປີດບັນຊີ"}
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
