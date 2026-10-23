import type { Metadata } from "next";
import { Suspense } from "react";
import { card } from "@/components/ui";
import { requireBranch } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { arrivalTemplate } from "@/lib/template";
import { SettingsForm } from "./settings-form";
import { TemplateEditor } from "./template-editor";
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
  const template = await arrivalTemplate(branch, createAdminClient());

  return (
    <>
      <section className={`${card} px-5 py-4`}>
        <h1 className="text-xl font-semibold">WhatsApp ຂອງສາຂາ</h1>
        <p className="text-sm text-zinc-500">
          ເຊື່ອມເບີ WhatsApp ຂອງສາຂາ {branch.name} ຜ່ານ OpenWA. ທຸກຂໍ້ຄວາມແຈ້ງບິນຈະສົ່ງຈາກເບີນີ້.
        </p>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <WhatsAppPanel initialStatus={branch.wa_session_id ? branch.wa_status : "not_connected"} />
        <SettingsForm
          branch={{
            staff_phone: branch.staff_phone ?? "",
            pickup_days: branch.pickup_days,
            daily_limit: branch.daily_limit,
            tel: branch.tel,
          }}
        />
      </div>
      <TemplateEditor
        template={template.body}
        shared={template.shared}
        custom={template.custom}
        branch={{
          name: branch.name,
          district: branch.district,
          province: branch.province,
          tel: branch.tel,
          staff_phone: branch.staff_phone,
          pickup_days: branch.pickup_days,
        }}
      />
    </>
  );
}

function Skeleton() {
  return (
    <>
      <div className={`${card} h-[76px] animate-pulse`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${card} h-96 animate-pulse`} />
        <div className={`${card} h-96 animate-pulse`} />
      </div>
      <div className={`${card} h-[480px] animate-pulse`} />
    </>
  );
}
