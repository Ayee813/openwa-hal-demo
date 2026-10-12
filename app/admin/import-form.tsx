"use client";

import { useActionState } from "react";
import { importShipments, type FormState } from "./actions";

export function ImportForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(importShipments, {});

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        name="file"
        type="file"
        required
        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 dark:file:bg-zinc-800"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "ກຳລັງນຳເຂົ້າ…" : "ນຳເຂົ້າບິນ"}
      </button>
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
