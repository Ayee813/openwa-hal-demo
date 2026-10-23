"use client";

import { useRef, useState, useTransition } from "react";
import { alert, btn, card, cardHead, hint } from "@/components/ui";
import { billMessage, type Bill } from "@/lib/bill";
import { PLACEHOLDERS, laosDatePlus, type MessageBranch } from "@/lib/message";
import { updateTemplate, type SettingsState } from "../actions";

/** A made-up parcel, so staff see the message before any real one is sent. */
const SAMPLE: Bill = {
  billNumber: "HAL0000123456",
  trackingId: null,
  statusText: null,
  receiverName: "ສົມສັກ ພົມມະວົງ",
  receiverPhone: "02055551234",
  senderName: null,
  senderPhone: null,
  startBranch: "ໂພນຕ້ອງ",
  startBranchTel: "02077771111",
  endBranch: null,
  endBranchTel: null,
  endVillage: null,
  endDistrict: null,
  endProvince: null,
  payType: "destination_freight_fees",
  totalFreight: 35_000,
  codAmount: null,
  weightKg: 2.5,
  sizeCm: 40,
  arrivedAt: null,
};

const MAX = 2000;

/** Each branch's own arrival message, with placeholders and a live preview. */
export function TemplateEditor({
  template,
  shared,
  custom,
  branch,
}: {
  /** What the branch sends now. */
  template: string;
  /** The shared template, used when the branch has none of its own. */
  shared: string;
  custom: boolean;
  branch: MessageBranch;
}) {
  const [body, setBody] = useState(template);
  const [saved, setSaved] = useState(template);
  const [result, setResult] = useState<SettingsState>({});
  const [pending, startTransition] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);

  const dirty = body !== saved;
  const unknown = [...new Set([...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].filter(
    (k) => !(k in PLACEHOLDERS),
  );
  const preview = body.trim()
    ? billMessage(body, { ...SAMPLE, arrivedAt: `${laosDatePlus(0)} 10:00:00` }, branch)
    : "";

  /** Puts `{key}` where the cursor is, then keeps typing after it. */
  function insert(key: string) {
    const el = textRef.current;
    const token = `{${key}}`;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function save(reset: boolean) {
    if (reset && !confirm("ລຶບຂໍ້ຄວາມຂອງສາຂານີ້ ແລ້ວກັບໄປໃຊ້ຂໍ້ຄວາມມາດຕະຖານ?")) return;
    const fd = new FormData();
    fd.set("body", body);
    if (reset) fd.set("reset", "1");
    startTransition(async () => {
      const r = await updateTemplate({}, fd);
      setResult(r);
      if (!r.ok) return;
      const next = reset ? shared : body.trim();
      setBody(next);
      setSaved(next);
    });
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <div>
          <h2 className="font-semibold">ຂໍ້ຄວາມແຈ້ງບິນ</h2>
          <p className={hint}>ແກ້ໄຂຂໍ້ຄວາມທີ່ສາຂານີ້ສົ່ງຫາລູກຄ້າ. ສາຂາອື່ນບໍ່ປ່ຽນຕາມ.</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            custom ? "bg-hal-soft text-hal" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {custom ? "ຂໍ້ຄວາມຂອງສາຂານີ້" : "ຂໍ້ຄວາມມາດຕະຖານ"}
        </span>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-baseline justify-between">
              <span className="font-medium">ຂໍ້ຄວາມ</span>
              <span className={`text-xs tabular-nums ${body.length > MAX ? "text-hal" : "text-zinc-400"}`}>
                {body.length}/{MAX}
              </span>
            </span>
            <textarea
              ref={textRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              spellCheck={false}
              className="w-full resize-y rounded border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-hal focus:ring-2 focus:ring-hal/15"
            />
          </label>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              ກົດເພື່ອໃສ່ຂໍ້ມູນ <span className="font-normal text-zinc-500">(ແທນທີ່ອັດຕະໂນມັດຕາມແຕ່ລະບິນ)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PLACEHOLDERS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => insert(key)}
                  title={`{${key}}`}
                  className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:border-hal hover:bg-hal-soft hover:text-hal"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={hint}>ແຖວທີ່ຂໍ້ມູນຫວ່າງທັງໝົດຈະຖືກຕັດອອກ (ເຊັ່ນ ແຖວເກັບເງິນ ເມື່ອຈ່າຍຕົ້ນທາງແລ້ວ).</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">
            ຕົວຢ່າງ <span className="font-normal text-zinc-500">(ບິນສົມມຸດ)</span>
          </p>
          <div className="flex-1 rounded-lg bg-[#efeae2] p-4">
            {preview ? (
              <pre className="ml-auto max-w-[92%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#dcf8c6] p-3 font-sans text-sm shadow-sm">
                {preview}
              </pre>
            ) : (
              <p className="py-10 text-center text-sm text-zinc-500">ຂໍ້ຄວາມຫວ່າງ</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-5 py-3 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          {unknown.length > 0 ? (
            <p className={alert.warn}>ບໍ່ຮູ້ຈັກ {unknown.map((k) => `{${k}}`).join(", ")} ກະລຸນາແກ້ກ່ອນບັນທຶກ</p>
          ) : result.error ? (
            <p role="alert" className={alert.error}>
              {result.error}
            </p>
          ) : result.ok && !dirty ? (
            <p className={alert.ok}>{result.ok}</p>
          ) : dirty ? (
            <p className="text-zinc-500">ມີການແກ້ໄຂທີ່ຍັງບໍ່ໄດ້ບັນທຶກ</p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {custom && (
            <button type="button" disabled={pending} onClick={() => save(true)} className={btn.outline}>
              ກັບໄປໃຊ້ມາດຕະຖານ
            </button>
          )}
          {dirty && (
            <button type="button" disabled={pending} onClick={() => setBody(saved)} className={btn.outline}>
              ຍົກເລີກ
            </button>
          )}
          <button
            type="button"
            disabled={pending || !dirty || !body.trim() || body.length > MAX || unknown.length > 0}
            onClick={() => save(false)}
            className={btn.primary}
          >
            {pending ? "ກຳລັງບັນທຶກ…" : "ບັນທຶກຂໍ້ຄວາມ"}
          </button>
        </div>
      </div>
    </section>
  );
}
