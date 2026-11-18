"use client";

import { useActionState, useState } from "react";
import { Spinner } from "@/components/spinner";
import { alert, btn, card, cardHead, field, hint } from "@/components/ui";
import {
  BOUNDS,
  PRESETS,
  RAMP_UP,
  dailyCap,
  estimateMinutes,
  isRisky,
  parsePacing,
  presetOf,
  type PacingConfig,
  type PresetKey,
} from "@/lib/pacing";
import { updatePacing, type SettingsState } from "../actions";

const PRESET_INFO: Record<PresetKey, { title: string; note: string; icon: string }> = {
  safe: { title: "ປອດໄພ", note: "ຊ້າ ແຕ່ປອດໄພທີ່ສຸດ", icon: "🛡️" },
  standard: { title: "ມາດຕະຖານ", note: "ແນະນຳ", icon: "⚖️" },
  fast: { title: "ໄວ", note: "ໄວ ແຕ່ສ່ຽງຖືກບລັອກເບີ", icon: "⚡" },
};

type Values = Record<NumberKey, string>;
type NumberKey = "delayMin" | "delayMax" | "batchSize" | "restMin" | "restMax" | "hourlyLimit" | "dailyLimit";

const toValues = (c: PacingConfig): Values => ({
  delayMin: String(c.delayMin),
  delayMax: String(c.delayMax),
  batchSize: String(c.batchSize),
  restMin: String(c.restMin),
  restMax: String(c.restMax),
  hourlyLimit: String(c.hourlyLimit),
  dailyLimit: String(c.dailyLimit),
});

/** "2 ຊົ່ວໂມງ 5 ນາທີ" for a number of minutes. */
function duration(min: number): string {
  if (min < 60) return `${min} ນາທີ`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ຊົ່ວໂມງ ${m} ນາທີ` : `${h} ຊົ່ວໂມງ`;
}

/** The branch's sending pace: presets, the numbers behind them, and what they mean in practice. */
export function PacingForm({
  initial,
  sentToday,
  days,
}: {
  initial: PacingConfig;
  /** Messages queued today. */
  sentToday: number;
  /** Days the branch's number has been in use; 0 is the first day. */
  days: number;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updatePacing, {});
  const [values, setValues] = useState<Values>(toValues(initial));
  const [rampUp, setRampUp] = useState(initial.rampUp);

  const parsed = parsePacing({ ...values, rampUp });
  const current = parsed.ok ? parsed.value : null;
  const active = current ? presetOf(current) : "custom";
  const cap = dailyCap(initial, days);
  const ramping = cap < initial.dailyLimit;

  function pick(key: PresetKey) {
    setValues(toValues(PRESETS[key]));
    setRampUp(PRESETS[key].rampUp);
  }

  const set = (key: NumberKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const num = (key: NumberKey, label: string, unit: string, step = 1) => (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <span className="flex items-center">
        <input
          name={key}
          type="number"
          inputMode="decimal"
          step={step}
          min={BOUNDS[key][0]}
          max={BOUNDS[key][1]}
          value={values[key]}
          onChange={set(key)}
          className={`${field} rounded-r-none tabular-nums`}
        />
        <span className="flex h-9 items-center whitespace-nowrap rounded-r border border-l-0 border-zinc-300 bg-head px-3 text-zinc-500">
          {unit}
        </span>
      </span>
      <span className={hint}>
        {BOUNDS[key][0]}–{BOUNDS[key][1]}
      </span>
    </label>
  );

  return (
    <form action={action} className={card}>
      <div className={cardHead}>
        <div>
          <h2 className="font-semibold">ຕັ້ງຄ່າການສົ່ງ</h2>
          <p className={hint}>ຄວບຄຸມຄວາມໄວໃນການສົ່ງ ເພື່ອບໍ່ໃຫ້ WhatsApp ບລັອກເບີຂອງສາຂາ.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5">
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="ຄວາມໄວໃນການສົ່ງ">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
            const info = PRESET_INFO[key];
            const on = active === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(key)}
                className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left text-sm transition-colors ${
                  on
                    ? key === "fast"
                      ? "border-amber-500 bg-amber-50"
                      : "border-hal bg-hal-soft"
                    : "border-zinc-300 bg-white hover:border-hal"
                }`}
              >
                <span className="font-semibold">
                  {info.icon} {info.title}
                </span>
                <span className={hint}>{info.note}</span>
                <span className="mt-1 text-xs tabular-nums text-zinc-600">
                  {PRESETS[key].delayMin}–{PRESETS[key].delayMax} ວິ · {PRESETS[key].hourlyLimit}/ຊມ ·{" "}
                  {PRESETS[key].dailyLimit}/ວັນ
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded bg-head px-3 py-2 text-sm">
          <span className="text-zinc-500">
            ມື້ນີ້ສົ່ງແລ້ວ
            {ramping && ` · ເບີໃໝ່ ມື້ທີ ${days + 1}`}
          </span>
          <span className="font-medium tabular-nums">
            {sentToday} / {cap} ຂໍ້ຄວາມ
          </span>
        </div>

        {/* Every value can be edited; a preset only fills them in. */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <div>
              <h3 className="text-sm font-semibold">ຄ່າທີ່ໃຊ້ຢູ່</h3>
              <p className={hint}>ແກ້ໄຂໄດ້ທຸກຄ່າ. ເລືອກແບບຂ້າງເທິງ ເພື່ອໃສ່ຄ່າໃຫ້ອັດຕະໂນມັດ.</p>
            </div>
            {active === "custom" && (
              <span className="rounded-full bg-hal-soft px-2.5 py-1 text-xs font-medium text-hal">ກຳນົດເອງ</span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {num("delayMin", "ຫ່າງລະຫວ່າງຂໍ້ຄວາມ ຕ່ຳສຸດ", "ວິນາທີ")}
            {num("delayMax", "ຫ່າງລະຫວ່າງຂໍ້ຄວາມ ສູງສຸດ", "ວິນາທີ")}
            {num("batchSize", "ພັກທຸກໆ", "ຂໍ້ຄວາມ")}
            <span className="hidden sm:block" />
            {num("restMin", "ພັກ ຕ່ຳສຸດ", "ນາທີ", 0.5)}
            {num("restMax", "ພັກ ສູງສຸດ", "ນາທີ", 0.5)}
            {num("hourlyLimit", "ສູງສຸດຕໍ່ຊົ່ວໂມງ", "ຂໍ້ຄວາມ")}
            {num("dailyLimit", "ສູງສຸດຕໍ່ວັນ", "ຂໍ້ຄວາມ")}
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              name="rampUp"
              type="checkbox"
              checked={rampUp}
              onChange={(e) => setRampUp(e.target.checked)}
              className="mt-0.5 size-4 accent-hal"
            />
            <span>
              <span className="font-medium">ເບີ WhatsApp ໃໝ່: ເພີ່ມຈຳນວນຄ່ອຍໆ</span>
              <span className={`${hint} block`}>
                ມື້ທີ 1 ສົ່ງໄດ້ {RAMP_UP[0]}, ມື້ທີ 2 {RAMP_UP[1]}, ມື້ທີ 3 {RAMP_UP[2]}, ຈາກນັ້ນຕາມເພດານຕໍ່ວັນ.
                ເບີທີ່ສົ່ງຫຼາຍໆທັນທີ ມີໂອກາດຖືກບລັອກສູງ.
              </span>
            </span>
          </label>
        </div>

        {current && (
          <p className="text-sm text-zinc-600">
            ສົ່ງ 100 ຂໍ້ຄວາມ ໃຊ້ເວລາປະມານ <b className="text-zinc-900">{duration(estimateMinutes(100, current))}</b>.
          </p>
        )}

        {current && isRisky(current) && (
          <p className={alert.warn}>
            ຄ່ານີ້ໄວກວ່າມາດຕະຖານ: ມີໂອກາດທີ່ WhatsApp ຈະບລັອກເບີຂອງສາຂາສູງຂຶ້ນ. ຖ້າເບີຖືກບລັອກ ຈະສົ່ງແຈ້ງບິນບໍ່ໄດ້.
          </p>
        )}
        {!parsed.ok && (
          <p role="alert" className={alert.error}>
            {parsed.error}
          </p>
        )}
        {state.error && (
          <p role="alert" className={alert.error}>
            {state.error}
          </p>
        )}
        {state.ok && <p className={alert.ok}>{state.ok}</p>}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className={hint}>ການປ່ຽນໃຊ້ກັບການສົ່ງຄັ້ງຕໍ່ໄປ.</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => pick("standard")} className={btn.outline}>
            ກັບໄປຄ່າມາດຕະຖານ
          </button>
          <button disabled={pending || !parsed.ok} className={btn.primary}>
            {pending && <Spinner />}
            {pending ? "ກຳລັງບັນທຶກ…" : "ບັນທຶກ"}
          </button>
        </div>
      </div>
    </form>
  );
}
