"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <input
        name="email"
        type="email"
        required
        autoComplete="username"
        placeholder="ອີເມວ"
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="ລະຫັດຜ່ານ"
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "ກຳລັງເຂົ້າ…" : "ເຂົ້າສູ່ລະບົບ"}
      </button>
    </form>
  );
}
