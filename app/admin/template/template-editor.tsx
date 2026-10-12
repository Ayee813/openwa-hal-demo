"use client";

import { useActionState, useState } from "react";
import { PLACEHOLDERS, renderMessage } from "@/lib/message";
import type { MessageKind } from "@/lib/types";
import { saveTemplate, type FormState } from "../actions";

const SAMPLE_SHIPMENT = {
  shipment_number: "VTE01608593950",
  receiver_name: "ນາງ ແສງດາວ ພົມມະຈັນ",
  weight_kg: 0.39,
  size_cm: 38,
  shipment_pay_type: "origin_freight_fees_cod",
  total_freight: 13000,
  cod_amount: 79000,
  pickup_deadline: "2026-10-19",
};

const SAMPLE_BRANCH = {
  name: "ຖິ່ນເພຍ",
  district: "ຫາດຊາຍຟອງ",
  tel: "52421659",
  staff_phone: "02078331163",
  pickup_days: 7,
};

export function TemplateEditor({
  kind,
  title,
  initial,
}: {
  kind: MessageKind;
  title: string;
  initial: string;
}) {
  const [body, setBody] = useState(initial);
  const [state, action, pending] = useActionState<FormState, FormData>(saveTemplate, {});

  return (
    <form
      action={action}
      className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 lg:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <input type="hidden" name="key" value={kind} />
      <div className="flex flex-col gap-2">
        <h2 className="font-medium">{title}</h2>
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={11}
          className="rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex flex-wrap gap-1">
          {Object.entries(PLACEHOLDERS).map(([key, label]) => (
            <button
              type="button"
              key={key}
              title={label}
              onClick={() => setBody((b) => `${b}{${key}}`)}
              className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {`{${key}}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "ກຳລັງບັນທຶກ…" : "ບັນທຶກ"}
          </button>
          {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
          {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-zinc-500">ຕົວຢ່າງ (ບິນ COD)</p>
        <div className="rounded-xl bg-[#efeae2] p-4 dark:bg-zinc-900">
          <pre className="ml-auto max-w-sm whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#dcf8c6] p-3 font-sans text-sm text-zinc-900 shadow-sm">
            {renderMessage(body, SAMPLE_SHIPMENT, SAMPLE_BRANCH)}
          </pre>
        </div>
      </div>
    </form>
  );
}
