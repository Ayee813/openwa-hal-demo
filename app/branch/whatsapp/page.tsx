import type { Metadata } from "next";
import { Suspense } from "react";
import { requireBranch } from "@/lib/auth";
import { SettingsForm } from "./settings-form";
import { WhatsAppPanel } from "./whatsapp-panel";

export const metadata: Metadata = { title: "WhatsApp ຂອງສາຂາ" };

export default function WhatsAppPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">ກຳລັງໂຫຼດ…</p>}>
      <WhatsApp />
    </Suspense>
  );
}

async function WhatsApp() {
  const { branch } = await requireBranch();

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">WhatsApp ຂອງສາຂາ</h1>
        <p className="text-sm text-zinc-500">
          ເຊື່ອມເບີ WhatsApp ຂອງສາຂາ {branch.name} ຜ່ານ OpenWA. ທຸກຂໍ້ຄວາມແຈ້ງບິນຈະສົ່ງຈາກເບີນີ້.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <WhatsAppPanel initialStatus={branch.wa_status} />
        <SettingsForm
          branch={{
            staff_phone: branch.staff_phone ?? "",
            pickup_days: branch.pickup_days,
            auto_send: branch.auto_send,
            daily_limit: branch.daily_limit,
            tel: branch.tel,
          }}
        />
      </div>
    </>
  );
}
