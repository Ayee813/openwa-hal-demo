import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WaBadge } from "@/components/badges";
import { card } from "@/components/ui";
import { usageToday } from "@/lib/notify";
import { resolvePacing } from "@/lib/pacing";
import { requireBranch } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { arrivalTemplate } from "@/lib/template";
import { PacingForm } from "./pacing-form";
import { SettingsForm } from "./settings-form";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "ຕັ້ງຄ່າ" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const { branch } = await requireBranch();
  const db = createAdminClient();
  const [template, usage] = await Promise.all([arrivalTemplate(branch, db), usageToday(branch.id, db)]);

  return (
    <>
      <section className={`${card} px-5 py-4`}>
        <h1 className="text-xl font-semibold">ຕັ້ງຄ່າ</h1>
        <p className="text-sm text-zinc-500">
          ຕັ້ງຄ່າການແຈ້ງບິນຂອງສາຂາ {branch.name}: ຂໍ້ມູນໃນຂໍ້ຄວາມ, ຄວາມໄວໃນການສົ່ງ ແລະ ຂໍ້ຄວາມແຈ້ງບິນ. ແຕ່ລະສາຂາຕັ້ງຂອງຕົນເອງ.
        </p>
      </section>

      <Link
        href="/whatsapp"
        className={`${card} flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm hover:ring-1 hover:ring-hal`}
      >
        <span>
          <span className="font-semibold">ການເຊື່ອມຕໍ່ WhatsApp</span>
          <span className="block text-xs text-zinc-500">
            {branch.wa_phone ? `ເບີ ${branch.wa_phone}` : "ເຊື່ອມ ຫຼື ຕັດການເຊື່ອມເບີ WhatsApp ຂອງສາຂາ"}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <WaBadge status={branch.wa_session_id ? branch.wa_status : "not_connected"} />
          <span className="text-hal">ໄປໜ້າ WhatsApp →</span>
        </span>
      </Link>

      <SettingsForm
        branch={{
          staff_phone: branch.staff_phone ?? "",
          pickup_days: branch.pickup_days,
          tel: branch.tel,
        }}
      />
      <PacingForm
        // The pace in use: what the branch saved, or the standard one.
        initial={resolvePacing(branch.pacing, branch.daily_limit)}
        sentToday={usage.sentToday}
        days={usage.days}
      />
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
      <div className="h-20 animate-pulse rounded-lg bg-white" />
      <div className="h-64 animate-pulse rounded-lg bg-white" />
      <div className="h-96 animate-pulse rounded-lg bg-white" />
    </>
  );
}
