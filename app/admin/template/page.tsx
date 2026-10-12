import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "ແມ່ແບບຂໍ້ຄວາມ" };

export default function TemplatePage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">ກຳລັງໂຫຼດ…</p>}>
      <Templates />
    </Suspense>
  );
}

async function Templates() {
  await requireProfile("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("message_templates").select("key, body");
  const body = (key: string) => data?.find((t) => t.key === key)?.body ?? "";

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">ແມ່ແບບຂໍ້ຄວາມ</h1>
        <p className="text-sm text-zinc-500">
          ໃຊ້ກັບທຸກສາຂາ. ແຖວທີ່ມີພຽງ {"{payment}"} ຈະຖືກລຶບອອກເມື່ອບິນບໍ່ມີ COD ຫຼື ຄ່າສົ່ງປາຍທາງ.
        </p>
      </div>
      <TemplateEditor kind="arrival" title="ແຈ້ງພັດສະດຸຮອດສາຂາ" initial={body("arrival")} />
      <TemplateEditor kind="reminder" title="ເຕືອນໃຫ້ມາຮັບ" initial={body("reminder")} />
    </>
  );
}
