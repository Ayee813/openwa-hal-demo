import type { Branch, Shipment } from "@/lib/types";

/**
 * Renders a message template. Pure, so the browser can preview exactly what the
 * server will send.
 *
 * `{name}` placeholders are replaced; a line that holds only placeholders which
 * all came out empty (e.g. `{payment}` on a prepaid bill) is dropped instead of
 * leaving a blank line in the message.
 */

export const PLACEHOLDERS = {
  shipment_number: "ເລກບິນ",
  receiver_name: "ຊື່ຜູ້ຮັບ",
  weight: "ນ້ຳໜັກ (ກິໂລ)",
  size: "ຂະໜາດ (cm)",
  payment: "ແຖວເກັບເງິນ (COD / ຄ່າສົ່ງປາຍທາງ), ຫວ່າງຖ້າບໍ່ມີ",
  branch_name: "ຊື່ສາຂາ",
  district: "ເມືອງ",
  staff_phone: "ເບີພະນັກງານ",
  branch_tel: "ເບີໂທສາຂາ",
  pickup_deadline: "ວັນທີຮັບກ່ອນ",
} as const;

export type MessageShipment = Pick<
  Shipment,
  | "shipment_number"
  | "receiver_name"
  | "weight_kg"
  | "size_cm"
  | "shipment_pay_type"
  | "total_freight"
  | "cod_amount"
  | "pickup_deadline"
>;

export type MessageBranch = Pick<
  Branch,
  "name" | "district" | "tel" | "staff_phone" | "pickup_days"
>;

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
    weight: decimal(s.weight_kg, 2),
    size: decimal(s.size_cm, 2),
    payment: paymentLine(s),
    branch_name: b.name,
    district: b.district ?? "",
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
      const onlyPlaceholders = keys.length > 0 && !line.replace(placeholder, "").trim();
      return onlyPlaceholders && !rendered.trim() ? [] : [rendered];
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
