import type { MessageStatus } from "@/lib/types";

const base =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

export const MESSAGE_LABEL: Record<MessageStatus, string> = {
  queued: "ລໍຖ້າສົ່ງ",
  sent: "ສົ່ງແລ້ວ ✓",
  delivered: "ຮອດແລ້ວ ✓✓",
  read: "ອ່ານແລ້ວ ✓✓",
  failed: "ລົ້ມເຫຼວ",
  no_whatsapp: "ບໍ່ມີ WhatsApp",
};

const MESSAGE_CLASS: Record<MessageStatus, string> = {
  queued: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  sent: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  delivered: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  read: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  no_whatsapp: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
};

export function MessageBadge({ status }: { status: MessageStatus | null }) {
  if (!status) return <span className="text-xs text-zinc-400">—</span>;
  return (
    <span className={`${base} ${MESSAGE_CLASS[status]}`}>
      {status === "queued" && <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />}
      {MESSAGE_LABEL[status]}
    </span>
  );
}

const WA: Record<string, [string, string]> = {
  ready: ["ເຊື່ອມແລ້ວ", "bg-green-500"],
  qr_ready: ["ລໍຖ້າສະແກນ QR", "bg-amber-500"],
  created: ["ກຳລັງເລີ່ມ…", "bg-amber-500"],
  initializing: ["ກຳລັງເລີ່ມ…", "bg-amber-500"],
  authenticating: ["ກຳລັງເຂົ້າລະບົບ…", "bg-amber-500"],
  disconnected: ["ຕັດການເຊື່ອມ", "bg-zinc-400"],
  not_connected: ["ຍັງບໍ່ເຊື່ອມ", "bg-zinc-400"],
  action_required: ["ຕ້ອງແກ້ໄຂ", "bg-red-500"],
  failed: ["ມີບັນຫາ", "bg-red-500"],
};

export function waLabel(status: string) {
  return (WA[status] ?? [status])[0];
}

export function WaBadge({ status }: { status: string }) {
  const [label, dot] = WA[status] ?? [status, "bg-zinc-400"];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span className={`size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
