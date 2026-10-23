import type { Branch } from "@/lib/types";

/**
 * Renders a message template. Pure, so the browser can preview exactly what the
 * server will send.
 *
 * `{name}` placeholders are replaced. A line whose placeholders all came out
 * empty (e.g. `{payment}` on a prepaid bill, or `ເບີໂທຕົ້ນທາງ: {start_tel}` when
 * HAL has no number) is dropped instead of sending a half-empty line.
 */

export const PLACEHOLDERS = {
  shipment_number: "ເລກບິນ",
  receiver_name: "ຊື່ຜູ້ຮັບ",
  receiver_phone: "ເບີຜູ້ຮັບ (020 xxxxxxxx)",
  weight: "ນ້ຳໜັກ (ກິໂລ)",
  size: "ຂະໜາດ (cm)",
  payment: "ແຖວເກັບເງິນ (COD / ຄ່າສົ່ງປາຍທາງ), ຫວ່າງຖ້າບໍ່ມີ",
  start_branch: "ສາຂາຕົ້ນທາງ",
  start_tel: "ເບີໂທສາຂາຕົ້ນທາງ",
  branch_name: "ຊື່ສາຂາປາຍທາງ",
  district: "ເມືອງ",
  address: "ທີ່ຕັ້ງສາຂາ (ບ້ານ, ເມືອງ, ແຂວງ)",
  branch_phones: "ເບີໂທສາຂາປາຍທາງ (ຕັ້ງຄ່າໃນໜ້າ WhatsApp)",
  staff_phone: "ເບີພະນັກງານ",
  branch_tel: "ເບີໂທສາຂາ",
  pickup_deadline: "ວັນທີຮັບກ່ອນ",
} as const;

export type MessageShipment = {
  shipment_number: string;
  receiver_name: string | null;
  weight_kg: number | null;
  size_cm: number | null;
  shipment_pay_type: string | null;
  total_freight: number | null;
  cod_amount: number | null;
  pickup_deadline: string | null;
  receiver_phone?: string | null;
  start_branch?: string | null;
  start_tel?: string | null;
};

export type MessageBranch = Pick<
  Branch,
  "name" | "district" | "tel" | "staff_phone" | "pickup_days"
> & {
  village?: string | null;
  province?: string | null;
};

/** "56666666" / "02056666666" / "8562056666666" → "020 56666666". */
export function displayPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  const local = digits.startsWith("856") ? digits.slice(3) : digits.replace(/^0/, "");
  if (/^20\d{8}$/.test(local)) return `020 ${local.slice(2)}`;
  if (/^\d{8}$/.test(local)) return `020 ${local}`;
  if (/^30\d{7}$/.test(local)) return `030 ${local.slice(2)}`;
  return (raw ?? "").trim();
}

/** "ບ້ານ ໂພນທັນ, ເມືອງ ໄຊເສດຖາ, ນະຄອນຫຼວງວຽງຈັນ", skipping missing parts. */
export function branchAddress(b: MessageBranch): string {
  return [
    b.village ? `ບ້ານ ${b.village}` : "",
    b.district ? `ເມືອງ ${b.district}` : "",
    b.province ?? "",
  ]
    .filter(Boolean)
    .join(", ");
}

const kip = new Intl.NumberFormat("en-US");

/** "2026-10-19" → "19/10/2026". */
export function formatDate(isoDate: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Today in Laos (UTC+7) plus `days`, as YYYY-MM-DD. */
export function laosDatePlus(days: number, from = new Date()): string {
  const t = new Date(from.getTime() + 7 * 3600_000 + days * 86400_000);
  return t.toISOString().slice(0, 10);
}

function decimal(n: number | null | undefined, digits: number): string {
  return n == null ? "-" : Number(n).toFixed(digits);
}

export function paymentLine(s: MessageShipment): string {
  const lines: string[] = [];
  if (s.cod_amount && Number(s.cod_amount) > 0) {
    lines.push(`ເກັບເງິນປາຍທາງ (COD): ${kip.format(Number(s.cod_amount))} ກີບ`);
  }
  if (
    s.shipment_pay_type?.startsWith("destination") &&
    s.total_freight &&
    Number(s.total_freight) > 0
  ) {
    lines.push(`ຄ່າຂົນສົ່ງປາຍທາງ: ${kip.format(Number(s.total_freight))} ກີບ`);
  }
  return lines.join("\n");
}

export function messageValues(
  s: MessageShipment,
  b: MessageBranch,
): Record<keyof typeof PLACEHOLDERS, string> {
  return {
    shipment_number: s.shipment_number,
    receiver_name: s.receiver_name ?? "",
    receiver_phone: displayPhone(s.receiver_phone),
    weight: decimal(s.weight_kg, 2),
    size: decimal(s.size_cm, 2),
    payment: paymentLine(s),
    start_branch: s.start_branch ?? "",
    start_tel: s.start_tel ?? "",
    branch_name: b.name,
    district: b.district ?? "",
    address: branchAddress(b),
    branch_phones: b.staff_phone ?? b.tel ?? "",
    staff_phone: b.staff_phone ?? b.tel ?? "",
    branch_tel: b.tel ?? "",
    pickup_deadline: formatDate(
      s.pickup_deadline ?? laosDatePlus(b.pickup_days),
    ),
  };
}

export function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  const placeholder = /\{(\w+)\}/g;

  return template
    .split("\n")
    .flatMap((line) => {
      const keys = [...line.matchAll(placeholder)].map((m) => m[1]);
      const rendered = line.replace(placeholder, (whole, key: string) =>
        key in values ? values[key] : whole,
      );
      const allEmpty = keys.length > 0 && keys.every((k) => k in values && !values[k].trim());
      return allEmpty ? [] : [rendered];
    })
    .join("\n")
    .trim();
}

export function renderMessage(
  template: string,
  s: MessageShipment,
  b: MessageBranch,
): string {
  return renderTemplate(template, messageValues(s, b));
}
