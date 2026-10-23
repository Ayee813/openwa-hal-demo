import type { Bill } from "@/lib/bill";
import type { DemoBill } from "@/lib/types";

/**
 * Mock bills for the development account. Pure, so it can be unit tested;
 * the database side is in lib/bills-source.ts.
 */

/** The dev account's own branch. Far above HAL's branch ids, so it never collides. */
export const DEMO_BRANCH_ID = 999_999;

export const DEMO_BRANCH = {
  id: DEMO_BRANCH_ID,
  name: "ທົດລອງ (DEV)",
  district: "ໄຊເສດຖາ",
  province: "ນະຄອນຫຼວງວຽງຈັນ",
  tel: "02055555555",
};

const FIRST = ["ສົມສັກ", "ບຸນມີ", "ຄຳຫຼ້າ", "ນ້ອຍ", "ແສງເດືອນ", "ພອນສະຫວັນ", "ວຽງໄຊ", "ມະນີວອນ", "ສີສຸພັນ", "ທອງໃສ"];
const LAST = ["ພົມມະວົງ", "ສີລາວົງ", "ແກ້ວມະນີ", "ຈັນທະວົງ", "ວົງສະຫວັນ", "ໄຊຍະສອນ", "ອິນທະວົງ"];
const ORIGINS: [string, string][] = [
  ["ໂພນຕ້ອງ", "02077771111"],
  ["ຫຼວງພະບາງ", "02077772222"],
  ["ປາກເຊ", "02077773333"],
  ["ສະຫວັນນະເຂດ", "02077774444"],
  ["ອຸດົມໄຊ", "02077775555"],
];
const PAY_TYPES = [
  "destination_freight_fees",
  "origin_freight_fees",
  "destination_freight_fees_cod",
  "origin_freight_fees_cod",
];
/** Numbers that land in the "ສົ່ງບໍ່ໄດ້" tab: 030, too short, masked, empty. */
const BAD_PHONES = ["0302123456", "2012345", "020****5048", ""];

export type DemoBillRow = {
  branch_id: number;
  bill_number: string;
  tracking_id: string;
  receiver_name: string;
  receiver_phone: string;
  sender_name: string;
  sender_phone: string;
  start_branch: string;
  start_branch_tel: string;
  pay_type: string;
  total_freight: number;
  cod_amount: number | null;
  weight_kg: number;
  size_cm: number;
  arrived_at: string;
};

export type GenerateOptions = {
  count: number;
  /** Receiver numbers, used in turn. */
  phones: string[];
  /** Laos date the parcels arrived, YYYY-MM-DD. */
  date: string;
  /** Mix in about one bad number in five. */
  includeBad: boolean;
  random?: () => number;
};

export function generateDemoBills(o: GenerateOptions): DemoBillRow[] {
  const rnd = o.random ?? Math.random;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
  const person = () => `${pick(FIRST)} ${pick(LAST)}`;
  const stamp = o.date.slice(2).replaceAll("-", "");

  return Array.from({ length: o.count }, (_, i) => {
    const [origin, originTel] = pick(ORIGINS);
    const payType = pick(PAY_TYPES);
    const bad = o.includeBad && i % 5 === 4;
    // Arrived during the working day, Laos time (UTC+7).
    const at = new Date(`${o.date}T${String(int(8, 17)).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}:00+07:00`);
    return {
      branch_id: DEMO_BRANCH_ID,
      bill_number: `DEV${stamp}${String(int(0, 999_999)).padStart(6, "0")}`,
      tracking_id: String(int(100_000, 999_999)),
      receiver_name: person(),
      receiver_phone: bad ? BAD_PHONES[Math.floor(i / 5) % BAD_PHONES.length]! : o.phones[i % o.phones.length]!,
      sender_name: person(),
      sender_phone: `020${int(5, 9)}${String(int(0, 9_999_999)).padStart(7, "0")}`,
      start_branch: origin,
      start_branch_tel: originTel,
      pay_type: payType,
      total_freight: int(2, 30) * 5_000,
      cod_amount: payType.endsWith("_cod") ? int(5, 100) * 10_000 : null,
      weight_kg: int(1, 200) / 10,
      size_cm: int(10, 120),
      arrived_at: at.toISOString(),
    };
  });
}

const num = (v: number | string | null) => (v == null ? null : Number(v));

/** A stored demo row in the same shape HAL bills take. */
export function demoRowToBill(r: DemoBill): Bill {
  return {
    billNumber: r.bill_number,
    trackingId: r.tracking_id,
    statusText: "ຮອດສາຂາປາຍທາງ",
    receiverName: r.receiver_name,
    receiverPhone: r.receiver_phone,
    senderName: r.sender_name,
    senderPhone: r.sender_phone,
    startBranch: r.start_branch,
    startBranchTel: r.start_branch_tel,
    // The branch settings fill the end-branch fields in the message.
    endBranch: null,
    endBranchTel: null,
    endVillage: null,
    endDistrict: null,
    endProvince: null,
    payType: r.pay_type,
    totalFreight: num(r.total_freight),
    codAmount: num(r.cod_amount),
    weightKg: num(r.weight_kg),
    sizeCm: num(r.size_cm),
    arrivedAt: r.arrived_at,
  };
}
