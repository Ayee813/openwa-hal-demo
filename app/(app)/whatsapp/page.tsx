import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { card } from "@/components/ui";
import { requireBranch } from "@/lib/session";
import { WhatsAppPanel } from "./whatsapp-panel";

export const metadata: Metadata = { title: "WhatsApp ຂອງສາຂາ" };

export default function WhatsAppPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <WhatsApp />
    </Suspense>
  );
}

async function WhatsApp() {
  const { branch } = await requireBranch();

  return (
    <>
      <section className={`${card} flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
        <div>
          <h1 className="text-xl font-semibold">WhatsApp ຂອງສາຂາ</h1>
          <p className="text-sm text-zinc-500">
            ເຊື່ອມເບີ WhatsApp ຂອງສາຂາ {branch.name} ຜ່ານ OpenWA. ທຸກຂໍ້ຄວາມແຈ້ງບິນຈະສົ່ງຈາກເບີນີ້.
          </p>
        </div>
        <Link href="/settings" className="text-sm text-hal hover:underline">
          ຕັ້ງຄ່າຄວາມໄວ ແລະ ຂໍ້ຄວາມ →
        </Link>
      </section>
      <div className="max-w-3xl">
        <WhatsAppPanel initialStatus={branch.wa_session_id ? branch.wa_status : "not_connected"} />
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <>
      <div className="h-20 animate-pulse rounded-lg bg-white" />
      <div className="h-80 max-w-3xl animate-pulse rounded-lg bg-white" />
    </>
  );
}
