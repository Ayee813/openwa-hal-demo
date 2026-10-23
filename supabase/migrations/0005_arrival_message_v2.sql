-- The arrival message HAL asked for. Lines whose values are all empty are
-- dropped when rendering (lib/message.ts), so `{payment}` only appears on COD
-- or pay-on-delivery bills and `ເບີໂທຕົ້ນທາງ` only when HAL has the number.

update message_templates
set body = $t$☺️ຮຸ່ງອາລຸນ ຂົນສົ່ງດ່ວນ ສະບາຍດີ,
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
ຂອບໃຈທີ່ໃຊ້ບໍລິການຮຸ່ງອາລຸນຂົນສົ່ງດ່ວນ🙏🏻$t$,
    updated_at = now()
where key = 'arrival';
