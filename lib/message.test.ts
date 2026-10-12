// Run with: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderMessage, renderTemplate } from "./message.ts";

const template = `😊ຮຸ່ງອາລຸນ ຂົນສົ່ງດ່ວນສະບາຍດີ,
ພັດສະດຸຮອດເລກ: {shipment_number}
ນ້ຳໜັກ: {weight} ກິໂລ | ຂະໜາດ: {size} cm
{payment}
ຮອດສາຂາ {branch_name},ເມືອງ {district},
ເບີໂທພະນັກງານຍິງຮັບເຄື່ອງ: {staff_phone}
ເບີໂທສາຂາ: {branch_tel}
ເຂົ້າຮັບກ່ອນວັນທີ {pickup_deadline}
ຂໍຂອບໃຈ🙏`;

const branch = {
  name: "ຖິ່ນເພຍ",
  district: "ຫາດຊາຍຟອງ",
  tel: "52421659",
  staff_phone: "02078331163",
  pickup_days: 7,
};

test("matches the agreed message for a prepaid bill", () => {
  const text = renderMessage(
    template,
    {
      shipment_number: "VTE01608593950",
      receiver_name: "ຜຮ",
      weight_kg: 0.39,
      size_cm: 38,
      shipment_pay_type: "origin_freight_fees",
      total_freight: 13000,
      cod_amount: null,
      pickup_deadline: "2026-10-19",
    },
    branch,
  );

  assert.equal(
    text,
    `😊ຮຸ່ງອາລຸນ ຂົນສົ່ງດ່ວນສະບາຍດີ,
ພັດສະດຸຮອດເລກ: VTE01608593950
ນ້ຳໜັກ: 0.39 ກິໂລ | ຂະໜາດ: 38.00 cm
ຮອດສາຂາ ຖິ່ນເພຍ,ເມືອງ ຫາດຊາຍຟອງ,
ເບີໂທພະນັກງານຍິງຮັບເຄື່ອງ: 02078331163
ເບີໂທສາຂາ: 52421659
ເຂົ້າຮັບກ່ອນວັນທີ 19/10/2026
ຂໍຂອບໃຈ🙏`,
  );
});

test("COD and destination freight add a payment line", () => {
  const text = renderMessage(
    template,
    {
      shipment_number: "VTE53854421524",
      receiver_name: null,
      weight_kg: 1,
      size_cm: 40,
      shipment_pay_type: "destination_freight_fees",
      total_freight: 39000,
      cod_amount: 79000,
      pickup_deadline: "2026-10-19",
    },
    branch,
  );
  assert.match(text, /ເກັບເງິນປາຍທາງ \(COD\): 79,000 ກີບ\nຄ່າຂົນສົ່ງປາຍທາງ: 39,000 ກີບ/);
});

test("unknown placeholders are left visible", () => {
  assert.equal(renderTemplate("a {nope} b", {}), "a {nope} b");
});
