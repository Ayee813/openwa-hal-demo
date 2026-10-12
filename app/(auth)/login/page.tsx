import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ເຂົ້າສູ່ລະບົບ" };

const ERRORS: Record<string, string> = {
  no_profile: "ບັນຊີນີ້ຍັງບໍ່ມີໂປຣໄຟລ໌ໃນລະບົບ. ຕິດຕໍ່ admin.",
  inactive: "ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ.",
  no_branch: "ບັນຊີນີ້ຍັງບໍ່ໄດ້ຜູກກັບສາຂາ. ຕິດຕໍ່ admin.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-red-600 font-bold text-white">
            HAL
          </span>
          <h1 className="text-xl font-semibold">HAL Express · ແຈ້ງບິນ WhatsApp</h1>
          <p className="text-sm text-zinc-500">ເຂົ້າສູ່ລະບົບສຳລັບ Admin ແລະ ພະນັກງານສາຂາ</p>
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
    <p role="alert" className="w-full rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {text}
    </p>
  );
}
