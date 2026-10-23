import { laosDatePlus, renderMessage, type MessageBranch } from "@/lib/message";
import { phoneProblem } from "@/lib/phone";
import type { MessageStatus } from "@/lib/types";

/** The latest WhatsApp message sent for a bill. */
export type LatestMessage = {
  status: MessageStatus;
  error: string | null;
  at: string;
};

/**
 * One bill waiting at the branch, flattened from a HAL `holding-shipments`
 * row. Pure, so client components can import the type and helpers.
 */

export type Bill = {
  /** Bill number shown to staff and customers; also the key in message_logs. */
  billNumber: string;
  trackingId: string | null;
  statusText: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  senderName: string | null;
  senderPhone: string | null;
  startBranch: string | null;
  startBranchTel: string | null;
  endBranch: string | null;
  endBranchTel: string | null;
  endVillage: string | null;
  endDistrict: string | null;
  endProvince: string | null;
  payType: string | null;
  totalFreight: number | null;
  codAmount: number | null;
  weightKg: number | null;
  sizeCm: number | null;
  /** When the parcel arrived at the branch, as HAL wrote it. */
  arrivedAt: string | null;
};

/** A bill with one of these as its latest message counts as already sent. */
export const SENT: MessageStatus[] = ["queued", "sent", "delivered", "read"];

/** Where a bill stands for staff: the tabs on the bills page. */
export type SendState = "not_sent" | "sending" | "sent" | "cannot" | "failed";

export const SEND_STATES: { key: SendState; label: string }[] = [
  { key: "not_sent", label: "ຍັງບໍ່ສົ່ງ" },
  { key: "sending", label: "ກຳລັງສົ່ງ" },
  { key: "sent", label: "ສົ່ງແລ້ວ" },
  { key: "cannot", label: "ສົ່ງບໍ່ໄດ້" },
  { key: "failed", label: "ສົ່ງບໍ່ສຳເລັດ" },
];

/**
 * `cannot` means sending again won't help (bad number, no WhatsApp);
 * `failed` means the gateway errored and a retry may work.
 */
export function sendState(
  b: Bill,
  m: LatestMessage | undefined,
): { state: SendState; reason: string | null } {
  if (m?.status === "queued") return { state: "sending", reason: null };
  if (m && SENT.includes(m.status)) return { state: "sent", reason: null };
  const bad = phoneProblem(b.receiverPhone);
  if (bad) return { state: "cannot", reason: bad };
  if (m?.status === "no_whatsapp") return { state: "cannot", reason: "ບໍ່ມີ WhatsApp" };
  if (m?.status === "failed") return { state: "failed", reason: m.error };
  return { state: "not_sent", reason: null };
}

export const PAY_LABEL: Record<string, string> = {
  destination_freight_fees_cod: "ປາຍທາງ + COD",
  origin_freight_fees_cod: "ຕົ້ນທາງ + COD",
  destination_freight_fees: "ເກັບປາຍທາງ",
  origin_freight_fees: "ຈ່າຍຕົ້ນທາງ",
};

/** "2026-10-20 17:08:33" or "2026-10-20T10:08:33.000000Z" → "2026-10-20 17:08". */
export function formatArrived(v: string | null): string {
  if (!v) return "—";
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
    }
  }
  return v.replace("T", " ").slice(0, 16);
}

/** The Laos calendar date the parcel arrived, YYYY-MM-DD. */
export function arrivedDate(v: string | null): string | null {
  const shown = formatArrived(v);
  return /^\d{4}-\d{2}-\d{2}/.test(shown) ? shown.slice(0, 10) : null;
}

/** YYYY-MM-DD plus `days`. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The WhatsApp message for one bill. Shared by the browser preview and the
 * server that sends it, so staff see exactly what the customer gets.
 * HAL's own branch details win; the branch settings fill the gaps.
 */
export function billMessage(template: string, b: Bill, branch: MessageBranch): string {
  const arrived = arrivedDate(b.arrivedAt) ?? laosDatePlus(0);
  return renderMessage(
    template,
    {
      shipment_number: b.billNumber,
      receiver_name: b.receiverName,
      receiver_phone: b.receiverPhone,
      weight_kg: b.weightKg,
      size_cm: b.sizeCm,
      shipment_pay_type: b.payType,
      total_freight: b.totalFreight,
      cod_amount: b.codAmount,
      pickup_deadline: addDays(arrived, branch.pickup_days),
      start_branch: b.startBranch,
      start_tel: b.startBranchTel,
    },
    {
      ...branch,
      name: b.endBranch || branch.name,
      tel: b.endBranchTel || branch.tel,
      village: b.endVillage || branch.village,
      district: b.endDistrict || branch.district,
      province: b.endProvince || branch.province,
    },
  );
}
