"use client";

import { useActionState, useState } from "react";
import { signIn, type SignInState } from "../actions";

const input =
  "h-11 w-full rounded border border-zinc-300 bg-white pr-3 pl-10 outline-none focus:border-hal focus:ring-2 focus:ring-hal/15";

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">ອີເມວ</span>
        <span className="relative">
          <MailIcon />
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            placeholder="name@hal-logistics.la"
            className={input}
          />
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">ລະຫັດຜ່ານ</span>
        <span className="relative">
          <LockIcon />
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={`${input} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "ເຊື່ອງລະຫັດຜ່ານ" : "ສະແດງລະຫັດຜ່ານ"}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-zinc-400 hover:text-hal"
          >
            <EyeIcon off={show} />
          </button>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-11 items-center justify-center gap-2 rounded bg-hal font-semibold text-white transition-colors hover:bg-hal-dark disabled:opacity-60"
      >
        {pending && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {pending ? "ກຳລັງເຂົ້າ…" : "ເຂົ້າສູ່ລະບົບ"}
      </button>
    </form>
  );
}

const iconCls = "pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-zinc-400";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={iconCls}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={iconCls}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-5">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}
