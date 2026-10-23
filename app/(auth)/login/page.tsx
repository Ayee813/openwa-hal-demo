import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ເຂົ້າສູ່ລະບົບ" };

const ERRORS: Record<string, string> = {
  expired: "ໝົດເວລາເຂົ້າລະບົບ, ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່.",
  no_branch: "ບໍ່ພົບຂໍ້ມູນສາຂາຂອງບັນຊີນີ້, ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-lg bg-white p-8 shadow-[0_10px_40px_rgba(20,30,50,.10)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/hal-logo.png" alt="HAL Express" width={88} height={88} priority />
          <div>
            <h1 className="text-xl font-semibold">ແຈ້ງບິນ WhatsApp</h1>
            <p className="text-sm text-zinc-500">ເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີ HAL Admin ຂອງທ່ານ</p>
          </div>
        </div>
        <Suspense>
          <ErrorNote searchParams={searchParams} />
        </Suspense>
        <LoginForm />
      </div>
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
