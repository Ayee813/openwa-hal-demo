"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatLaoPhone } from "@/lib/phone";
import { scanShipment, type ScanResult } from "../actions";

type Entry = ScanResult & { at: Date; key: number };

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

const TONE: Record<ScanResult["outcome"], string> = {
  arrived: "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
  duplicate: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  done: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  not_found: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  empty: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  error: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
};

/** Short beep: high for a good scan, low for anything else. */
function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 1200 : 320;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
    osc.onended = () => ctx.close();
  } catch {
    // Audio is a nicety.
  }
}

export function ScanPanel({ autoSend, waReady }: { autoSend: boolean; waReady: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "denied">("off");
  const [detecting, setDetecting] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [number, setNumber] = useState("");
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [pending, startTransition] = useTransition();
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const seq = useRef(0);

  function record(result: ScanResult) {
    const ok = result.outcome === "arrived";
    beep(ok);
    setFlash(ok ? "ok" : "bad");
    setTimeout(() => setFlash(null), 600);
    setEntries((xs) => [{ ...result, at: new Date(), key: ++seq.current }, ...xs].slice(0, 30));
  }

  function scan(input: { number?: string; simulate?: boolean }) {
    startTransition(async () => {
      record(await scanShipment(input));
    });
  }

  // Camera, plus real barcode reading where the browser has BarcodeDetector.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return setCamera("denied");
      setCamera("starting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        setCamera("on");

        const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        if (!Ctor) return;
        const detector = new Ctor({ formats: ["code_128", "code_39", "qr_code", "ean_13"] });
        setDetecting(true);
        timer = setInterval(async () => {
          if (video.readyState < 2) return;
          const codes = await detector.detect(video).catch(() => []);
          const code = codes[0]?.rawValue?.trim();
          if (!code) return;
          const prev = lastCode.current;
          if (prev && prev.code === code && Date.now() - prev.at < 4000) return;
          lastCode.current = { code, at: Date.now() };
          scan({ number: code });
        }, 600);
      } catch {
        setCamera("denied");
      }
    }

    start();
    return () => {
      cancelled = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once on mount
  }, []);

  const arrivedCount = entries.filter((e) => e.outcome === "arrived").length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div
          className={`relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-900 ring-4 transition ${
            flash === "ok" ? "ring-green-500" : flash === "bad" ? "ring-red-500" : "ring-transparent"
          }`}
        >
          <video ref={videoRef} muted playsInline className="size-full object-cover" />
          {camera !== "on" && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-zinc-300">
              {camera === "denied"
                ? "ເປີດກ້ອງບໍ່ໄດ້ (ບໍ່ອະນຸຍາດ ຫຼື ບໍ່ມີກ້ອງ). ຍັງໃຊ້ປຸ່ມຈຳລອງ ຫຼື ພິມເລກບິນໄດ້."
                : "ກຳລັງເປີດກ້ອງ…"}
            </div>
          )}
          {/* Aiming frame and sweeping line */}
          <div className="pointer-events-none absolute inset-[12%_10%] rounded-lg border-2 border-white/70">
            <div
              className="absolute inset-x-2 h-0.5 bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.7)]"
              style={{ animation: "scanline 2.4s ease-in-out infinite" }}
            />
          </div>
          <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
            {detecting ? "ກຳລັງອ່ານ barcode ອັດຕະໂນມັດ" : "ໂໝດ demo: ກົດປຸ່ມຈຳລອງດ້ານລຸ່ມ"}
          </div>
        </div>

        <button
          onClick={() => scan({ simulate: true })}
          disabled={pending}
          className="rounded-xl bg-red-600 px-4 py-4 text-lg font-semibold text-white shadow hover:bg-red-700 active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "ກຳລັງບັນທຶກ…" : "📦 ຈຳລອງສະແກນ (ບິນຖັດໄປ)"}
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (number.trim()) scan({ number });
            setNumber("");
          }}
          className="flex gap-2"
        >
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="ພິມ ຫຼື ຍິງ barcode: VTE01608593950"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm uppercase dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            ຮັບເຂົ້າ
          </button>
        </form>

        {autoSend && !waReady && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            ເປີດສົ່ງອັດຕະໂນມັດຢູ່ ແຕ່ WhatsApp ຍັງບໍ່ເຊື່ອມ: ສະແກນໄດ້ ແຕ່ຂໍ້ຄວາມຈະບໍ່ຖືກສົ່ງ.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500">
          ສະແກນໃນຮອບນີ້ · ຮັບເຂົ້າ {arrivedCount} ບິນ
        </h2>
        {entries.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            ຍັງບໍ່ມີການສະແກນ
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {entries.map((e) => (
            <li key={e.key} className={`rounded-lg border px-3 py-2 text-sm ${TONE[e.outcome]}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{e.message}</span>
                <span className="text-xs opacity-70">
                  {e.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
              {e.shipment && (
                <div className="mt-0.5 font-mono text-xs">
                  {e.shipment.shipment_number} · {e.shipment.receiver_name ?? "—"} ·{" "}
                  {formatLaoPhone(e.shipment.receiver_phone)}
                </div>
              )}
              {e.sent && (
                <div className="mt-1 text-xs">
                  {e.sent.error
                    ? `WhatsApp: ສົ່ງບໍ່ໄດ້ (${e.sent.error})`
                    : e.sent.queued
                      ? "WhatsApp: ເຂົ້າຄິວສົ່ງແຈ້ງລູກຄ້າແລ້ວ ✓"
                      : "WhatsApp: ບໍ່ໄດ້ສົ່ງ (ເບີບໍ່ຖືກຕ້ອງ)"}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
