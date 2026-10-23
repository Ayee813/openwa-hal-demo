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

test("HAL arrival message v2 matches the agreed example", () => {
  const v2 = `☺️ຮຸ່ງອາລຸນ ຂົນສົ່ງດ່ວນ ສະບາຍດີ,
🚚 ພັດສະດຸຮອດປາຍທາງແລ້ວ ສາຂາ {branch_name}
ເລກ: {shipment_number}
- ຜູ້ຮັບ: {receiver_name} | {receiver_phone}
- ນ້ຳໜັກ: {weight} kg
- ຂະໜາດ: {size} cm
{payment}
ສາຂາຕົ້ນທາງ: {start_branch}
ເບີໂທຕົ້ນທາງ: {start_tel}
ເບີໂທສາຂາປາຍທາງ: {branch_phones}
📍ທີ່ຕັ້ງສາຂາ: {address}
❗️ເຂົ້າຮັບພັດສະດຸກ່ອນວັນທີ {pickup_deadline}
ຂອບໃຈທີ່ໃຊ້ບໍລິການຮຸ່ງອາລຸນຂົນສົ່ງດ່ວນ🙏🏻`;

  const shipment = {
    shipment_number: "VTE53938954991",
    receiver_name: "Alex",
    receiver_phone: "56666666",
    weight_kg: 5.51,
    size_cm: 78,
    shipment_pay_type: "origin_freight_fees",
    total_freight: 20000,
    cod_amount: null,
    pickup_deadline: "2026-07-26",
    start_branch: "Buber Shop",
    start_tel: "020 ×××××",
  };
  const branch = {
    name: "ໂພນທັນ2",
    village: "ໂພນທັນ",
    district: "ໄຊເສດຖາ",
    province: "ນະຄອນຫຼວງວຽງຈັນ",
    tel: "52415523",
    staff_phone: "02052415523 | 02054656540",
    pickup_days: 7,
  };

  assert.equal(
    renderMessage(v2, shipment, branch),
    `☺️ຮຸ່ງອາລຸນ ຂົນສົ່ງດ່ວນ ສະບາຍດີ,
🚚 ພັດສະດຸຮອດປາຍທາງແລ້ວ ສາຂາ ໂພນທັນ2
ເລກ: VTE53938954991
- ຜູ້ຮັບ: Alex | 020 56666666
- ນ້ຳໜັກ: 5.51 kg
- ຂະໜາດ: 78.00 cm
ສາຂາຕົ້ນທາງ: Buber Shop
ເບີໂທຕົ້ນທາງ: 020 ×××××
ເບີໂທສາຂາປາຍທາງ: 02052415523 | 02054656540
📍ທີ່ຕັ້ງສາຂາ: ບ້ານ ໂພນທັນ, ເມືອງ ໄຊເສດຖາ, ນະຄອນຫຼວງວຽງຈັນ
❗️ເຂົ້າຮັບພັດສະດຸກ່ອນວັນທີ 26/07/2026
ຂອບໃຈທີ່ໃຊ້ບໍລິການຮຸ່ງອາລຸນຂົນສົ່ງດ່ວນ🙏🏻`,
  );

  // Missing origin phone drops its line; COD adds the payment line.
  const cod = renderMessage(v2, { ...shipment, start_tel: null, cod_amount: 79000 }, branch);
  assert.doesNotMatch(cod, /ເບີໂທຕົ້ນທາງ/);
  assert.match(cod, /- ຂະໜາດ: 78\.00 cm\nເກັບເງິນປາຍທາງ \(COD\): 79,000 ກີບ\nສາຂາຕົ້ນທາງ/);
});
