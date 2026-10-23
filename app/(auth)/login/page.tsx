import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Truck } from "@/components/truck";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ເຂົ້າສູ່ລະບົບ" };

const ERRORS: Record<string, string> = {
  expired: "ໝົດເວລາເຂົ້າລະບົບ, ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່.",
  no_branch: "ບໍ່ພົບຂໍ້ມູນສາຂາຂອງບັນຊີນີ້, ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່.",
};

const POINTS = [
  "ເບິ່ງເຄື່ອງທີ່ຮອດສາຂາ ຈາກລະບົບ HAL ໂດຍກົງ",
  "ແຈ້ງລູກຄ້າທາງ WhatsApp ເທື່ອລະຫຼາຍບິນ",
  "ຕິດຕາມສະຖານະ: ສົ່ງແລ້ວ, ຮອດແລ້ວ, ອ່ານແລ້ວ",
];

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="grid flex-1 grid-rows-[auto_1fr] lg:grid-cols-[1.15fr_1fr] lg:grid-rows-1">
      {/* ---------- Brand + truck ---------- */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-hal-soft via-white to-white px-6 py-8 lg:border-r lg:border-line lg:px-14 lg:py-12">
        {/* Quarter circles: each centred exactly on a corner of the panel. */}
        <CornerCircle className="top-0 right-0 translate-x-1/2 -translate-y-1/2" />
        <CornerCircle className="bottom-0 left-0 hidden -translate-x-1/2 translate-y-1/2 lg:grid" />

        <div className="mx-auto flex h-full w-full max-w-xl flex-col">
          <div className="relative flex items-center gap-3">
            <Image src="/hal-logo.png" alt="HAL Express" width={48} height={48} priority />
            <div className="leading-tight">
              <p className="font-semibold">HAL Express</p>
              <p className="text-xs text-zinc-500">ແຈ້ງບິນ WhatsApp</p>
            </div>
          </div>

          <div className="relative my-auto flex flex-col gap-6 pt-8 lg:pt-0">
            <div className="hidden max-w-md lg:block">
              <h2 className="text-3xl leading-snug font-semibold">
                ເຄື່ອງຮອດສາຂາ,
                <br />
                <span className="text-hal">ລູກຄ້າຮູ້ທັນທີ.</span>
              </h2>
            </div>

            <Truck className="truck-in w-full max-w-xl" />

            <ul className="hidden flex-col gap-2.5 lg:flex">
              {POINTS.map((p) => (
                <li key={p} className="flex items-center gap-3 text-sm text-zinc-700">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-hal text-white">
                    <CheckIcon />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Sign in ---------- */}
      <section className="flex items-start justify-center bg-white px-6 pt-8 pb-10 lg:items-center lg:px-14 lg:py-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold">ເຂົ້າສູ່ລະບົບ</h1>
            <p className="mt-1 text-sm text-zinc-500">ໃຊ້ບັນຊີ HAL Admin ຂອງທ່ານ</p>
          </div>
          <Suspense>
            <ErrorNote searchParams={searchParams} />
          </Suspense>
          <LoginForm />
          <p className="text-center text-xs text-zinc-400">© HAL Express · ຮຸ່ງອາລຸນ ຂົນສົ່ງດ່ວນ</p>
        </div>
      </section>
    </main>
  );
}

async function ErrorNote({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  const text = typeof error === "string" ? ERRORS[error] : undefined;
  if (!text) return null;
  return (
    <p role="alert" className="w-full rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {text}
    </p>
  );
}

/** A soft disc with a thin ring around it; only the quarter inside the panel shows. */
function CornerCircle({ className }: { className: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute -z-10 grid size-56 place-items-center lg:size-[30rem] ${className}`}>
      <div className="absolute inset-0 rounded-full border border-hal/10" />
      <div className="size-[72%] rounded-full bg-hal/[0.06]" />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3.5">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}
