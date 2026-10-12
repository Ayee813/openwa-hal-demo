import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireBranch } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ScanPanel } from "./scan-panel";

export const metadata: Metadata = { title: "ສະແກນເຄື່ອງເຂົ້າສາຂາ" };

export default function ScanPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">ກຳລັງໂຫຼດ…</p>}>
      <Scan />
    </Suspense>
  );
}

async function Scan() {
  const { branch } = await requireBranch();
  const supabase = await createClient();
  const { count } = await supabase
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("end_branch_id", branch.id)
    .eq("parcel_status", "in_transit");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ສະແກນເຄື່ອງເຂົ້າສາຂາ</h1>
          <p className="text-sm text-zinc-500">
            ສະແກນ barcode ເທິງບິນ, ພິມເລກບິນ, ຫຼື ກົດ “ຈຳລອງສະແກນ” ສຳລັບ demo. ກຳລັງມາ:{" "}
            <b className="tabular-nums">{count ?? 0}</b> ບິນ
          </p>
        </div>
        <Link
          href="/branch/whatsapp"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            branch.auto_send
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          ສົ່ງ WhatsApp ອັດຕະໂນມັດ: {branch.auto_send ? "ເປີດ" : "ປິດ"}
        </Link>
      </div>
      <ScanPanel autoSend={branch.auto_send} waReady={branch.wa_status === "ready"} />
    </>
  );
}
