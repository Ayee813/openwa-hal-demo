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
        className="h-11 rounded border border-zinc-300 bg-white px-3 outline-none focus:border-hal focus:ring-2 focus:ring-hal/15"
      />
      <input
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="ລະຫັດຜ່ານ"
        className="h-11 rounded border border-zinc-300 bg-white px-3 outline-none focus:border-hal focus:ring-2 focus:ring-hal/15"
      />
      {state.error && (
        <p role="alert" className="text-sm text-hal">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 rounded bg-hal font-semibold text-white hover:bg-hal-dark disabled:opacity-60"
      >
        {pending ? "ກຳລັງເຂົ້າ…" : "ເຂົ້າສູ່ລະບົບ"}
      </button>
    </form>
  );
}
