"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MessageBadge } from "@/components/badges";
import { Spinner } from "@/components/spinner";
import {
  PAY_LABEL,
  SEND_STATES,
  SENT,
  billMessage,
  formatArrived,
  sendState,
  type Bill,
  type LatestMessage,
  type SendState,
} from "@/lib/bill";
import type { MessageBranch } from "@/lib/message";
import { phoneProblem } from "@/lib/phone";
import { billStatuses, sendBills, type BillFilter } from "../actions";
import { DemoTools } from "./demo-tools";

const kip = new Intl.NumberFormat("en-US");
/** Bills per page; the page parses the same list. */
const PER_PAGE = [10, 20, 50, 100];
/** How often statuses are re-read while messages are in flight. */
const POLL_MS = 8000;

type Notice = { tone: "ok" | "error"; text: string } | null;
type Pending = { kind: "selected" | "all" | "one"; bills: Bill[]; resend: boolean } | null;
type View = { send: SendState | null; page: number; limit: number };

export function BillsTable({
  bills: found,
  initialStatuses,
  filter,
  q,
  initialSend,
  initialPage,
  initialLimit,
  truncated,
  error,
  template,
  branch,
  demo,
}: {
  /** Every bill in the range (after search); tabs and pages are cut here. */
  bills: Bill[];
  initialStatuses: Record<string, LatestMessage>;
  filter: BillFilter;
  q: string;
  initialSend: SendState | null;
  initialPage: number;
  initialLimit: number;
  truncated: boolean;
  error: string | null;
  template: string;
  branch: MessageBranch & { wa_ready: boolean };
  /** Development account: show the mock-bill tools. */
  demo: boolean;
}) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [seen, setSeen] = useState(initialStatuses);
  const [view, setView] = useState<View>({ send: initialSend, page: initialPage, limit: initialLimit });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice>(null);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [detail, setDetail] = useState<Bill | null>(null);
  /** Bills being queued right now, for a spinner on their row. */
  const [queuing, setQueuing] = useState<Set<string>>(new Set());
  /** Rows whose status just changed, briefly highlighted. */
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(true);
  const [busy, startTransition] = useTransition();
  const [navigating, startNav] = useTransition();
  const router = useRouter();
  const confirmRef = useRef<HTMLDialogElement>(null);
  const connectRef = useRef<HTMLDialogElement>(null);
  const detailRef = useRef<HTMLDialogElement>(null);

  // A server refresh (after generating demo bills, say) brings new statuses.
  if (initialStatuses !== seen) {
    setSeen(initialStatuses);
    setStatuses(initialStatuses);
  }

  // Tab counts and the current page, all from the one list.
  const counts = Object.fromEntries(SEND_STATES.map((s) => [s.key, 0])) as Record<SendState, number>;
  const inTab: Bill[] = [];
  for (const b of found) {
    const { state } = sendState(b, statuses[b.billNumber]);
    counts[state]++;
    if (!view.send || state === view.send) inTab.push(b);
  }
  const { limit } = view;
  const total = inTab.length;
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(view.page, lastPage);
  const bills = inTab.slice((page - 1) * limit, page * limit);

  const sendable = bills.filter((b) => !phoneProblem(b.receiverPhone));
  const allChecked = sendable.length > 0 && sendable.every((b) => selected.has(b.billNumber));
  const chosen = sendable.filter((b) => selected.has(b.billNumber));
  const unsent = counts.not_sent + counts.failed;

  /** Replaces statuses and highlights the rows that changed. */
  function applyStatuses(next: Record<string, LatestMessage>) {
    const changed = Object.keys(next).filter((n) => next[n]?.status !== statuses[n]?.status);
    setStatuses((s) => ({ ...s, ...next }));
    if (changed.length) setFlash(new Set(changed));
  }

  useEffect(() => {
    if (flash.size === 0) return;
    const t = setTimeout(() => setFlash(new Set()), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (notice?.tone !== "ok") return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  // Back and forward move between tabs and pages too.
  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      const send = p.get("send");
      setView({
        send: SEND_STATES.some((s) => s.key === send) ? (send as SendState) : null,
        page: Math.max(1, Number(p.get("page")) || 1),
        limit: PER_PAGE.includes(Number(p.get("limit"))) ? Number(p.get("limit")) : 20,
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  // Poll the bills still in flight (queued, or sent in the last 15 minutes),
  // only while this tab is in view.
  useEffect(() => {
    if (!visible) return;
    const live = Object.entries(statuses)
      .filter(([, s]) => s.status === "queued" || (s.status === "sent" && Date.now() - Date.parse(s.at) < 15 * 60_000))
      .map(([n]) => n);
    if (live.length === 0) return;
    const t = setTimeout(async () => {
      const next = await billStatuses(live.slice(0, 1000)).catch(() => null);
      if (next) applyStatuses(next);
    }, POLL_MS);
    return () => clearTimeout(t);
    // applyStatuses only reads `statuses`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, visible]);

  useEffect(() => {
    if (confirm) confirmRef.current?.showModal();
    else confirmRef.current?.close();
  }, [confirm]);

  useEffect(() => {
    if (detail) detailRef.current?.showModal();
    else detailRef.current?.close();
  }, [detail]);

  function toggle(n: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  function preview(b: Bill): string {
    return billMessage(template, b, branch);
  }

  /** Confirms a send, or asks to connect WhatsApp first when it isn't. */
  function ask(p: NonNullable<Pending>) {
    if (branch.wa_ready) setConfirm(p);
    else connectRef.current?.showModal();
  }

  function sendOne(b: Bill) {
    const prev = statuses[b.billNumber];
    ask({
      kind: "one",
      bills: [b],
      resend: !!prev && (SENT.includes(prev.status) || prev.status === "no_whatsapp"),
    });
  }

  function run(p: NonNullable<Pending>) {
    const numbers = p.kind === "all" ? found.map((b) => b.billNumber) : p.bills.map((b) => b.billNumber);
    setQueuing(new Set(numbers));
    startTransition(async () => {
      const res = await sendBills({
        filter,
        billNumbers: p.kind === "all" ? undefined : numbers,
        resend: p.resend,
      });
      setConfirm(null);
      if (res.needsWhatsApp) {
        connectRef.current?.showModal();
        // The sidebar and banner show the WhatsApp state from the server.
        router.refresh();
      } else if (res.error) {
        setNotice({ tone: "error", text: res.error });
      } else {
        const extra = [
          res.alreadySent ? `ຂ້າມ ${res.alreadySent} ບິນທີ່ສົ່ງແລ້ວ` : "",
          res.cannot ? `ຂ້າມ ${res.cannot} ບິນທີ່ສົ່ງບໍ່ໄດ້` : "",
        ].filter(Boolean);
        setNotice({
          tone: "ok",
          text: `ເຂົ້າຄິວສົ່ງ ${res.queued} ຂໍ້ຄວາມ${extra.length ? ` · ${extra.join(" · ")}` : ""}. ລະບົບສົ່ງເທື່ອລະຂໍ້ຄວາມ ຫ່າງກັນ 10–40 ວິນາທີ ແລະ ພັກເປັນໄລຍະ ເພື່ອບໍ່ໃຫ້ WhatsApp ບລັອກເບີ, ອາດໃຊ້ເວລາຫຼາຍນາທີ.`,
        });
        setSelected(new Set());
      }
      const next = await billStatuses(numbers.slice(0, 1000)).catch(() => null);
      if (next) applyStatuses(next);
      setQueuing(new Set());
    });
  }

  /** Switches tab, page or page size at once, keeping the URL in step. */
  function show(next: Partial<View>) {
    const v = { ...view, ...next };
    setView(v);
    setSelected(new Set());
    window.history.pushState(null, "", url(v));
  }

  const url = (v: View) => {
    const p = new URLSearchParams({ start: filter.startDate, end: filter.endDate });
    if (!filter.status) p.set("status", "all");
    if (q) p.set("q", q);
    p.set("send", v.send ?? "all");
    p.set("limit", String(v.limit));
    p.set("page", String(v.page));
    return `/bills?${p}`;
  };

  /** Search and clear load new bills from the server; the table dims meanwhile. */
  function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p = new URLSearchParams();
    for (const [k, v] of fd) if (typeof v === "string" && v) p.set(k, v);
    p.set("send", view.send ?? "all");
    startNav(() => router.push(`/bills?${p}`));
  }

  const input =
    "h-9 w-full rounded border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-hal focus:ring-2 focus:ring-hal/15";

  return (
    <div className="flex flex-col gap-4">
      {navigating && <div className="nav-progress" role="progressbar" aria-label="ກຳລັງໂຫຼດ" />}

      {/* ---------- Title + filters ---------- */}
      <section className="rounded-lg bg-white px-5 py-4">
        <div className="mb-4 flex items-baseline gap-3">
          <h1 className="text-xl font-semibold">ເຄື່ອງຮອດສາຂາປາຍທາງ</h1>
          <span className="text-sm text-zinc-400">ແຈ້ງລູກຄ້າທາງ WhatsApp</span>
          {demo && <DemoTools date={filter.endDate} />}
        </div>
        <form onSubmit={search} className="grid gap-3 md:grid-cols-[2fr_1.3fr_1.3fr_1fr_0.7fr_auto_auto] md:items-end">
          <label className="flex flex-col gap-1 text-sm">
            ຄົ້ນຫາ:
            <input name="q" defaultValue={q} placeholder="ຄົ້ນຫາ ເບີໂທ, ບິນລູກຄ້າ" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ເລີ່ມວັນທີ:
            <input name="start" type="date" defaultValue={filter.startDate} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ວັນທີສິ້ນສຸດ:
            <input name="end" type="date" defaultValue={filter.endDate} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ສະຖານະ:
            <select name="status" defaultValue={filter.status ? "" : "all"} className={input}>
              <option value="">ຮອດສາຂາ (ລໍຖ້າຮັບ)</option>
              <option value="all">ທັງໝົດ</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ຕໍ່ໜ້າ:
            <select name="limit" defaultValue={limit} className={input}>
              {PER_PAGE.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={navigating}
            className="flex h-9 min-w-36 items-center justify-center gap-2 rounded bg-hal px-6 text-sm font-medium text-white hover:bg-hal-dark disabled:opacity-80"
          >
            {navigating ? <Spinner /> : <SearchIcon />} {navigating ? "ກຳລັງຄົ້ນຫາ…" : "ຄົ້ນຫາ"}
          </button>
          <button
            type="button"
            disabled={navigating}
            onClick={() => startNav(() => router.push("/bills"))}
            className="flex h-9 items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-8 text-sm hover:border-hal hover:text-hal disabled:opacity-60"
          >
            ↻ ລ້າງ
          </button>
        </form>
      </section>

      {/* ---------- Send-state tabs ---------- */}
      <nav aria-label="ສະຖານະການສົ່ງ" className="flex flex-wrap gap-2">
        {/* The default tab first, "all" last. */}
        {[...SEND_STATES, { key: null, label: "ທັງໝົດ" }].map((t) => {
          const n = t.key ? counts[t.key] : found.length;
          const on = view.send === t.key;
          return (
            <a
              key={t.key ?? "all"}
              href={url({ ...view, send: t.key, page: 1 })}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                show({ send: t.key, page: 1 });
              }}
              aria-current={on ? "page" : undefined}
              className={`flex h-9 items-center gap-2 rounded-full border px-4 text-sm transition-colors ${
                on ? "border-hal bg-hal text-white" : "border-zinc-300 bg-white hover:border-hal hover:text-hal"
              }`}
            >
              {t.key && <span className={`size-2 rounded-full ${STATE_DOT[t.key]}`} />}
              {t.label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/25" : "bg-zinc-100"}`}>
                {n}
              </span>
            </a>
          );
        })}
      </nav>

      {/* ---------- Actions ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={busy || navigating || chosen.length === 0}
          onClick={() => ask({ kind: "selected", bills: chosen, resend: false })}
          className="flex h-9 items-center gap-2 rounded bg-wa px-4 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {busy && confirm?.kind === "selected" ? <Spinner /> : <WaIcon className="size-4" />} ສົ່ງບິນທີ່ເລືອກ ({chosen.length})
        </button>
        <button
          disabled={busy || navigating || unsent === 0}
          onClick={() => ask({ kind: "all", bills: sendable, resend: false })}
          className="flex h-9 items-center gap-2 rounded border border-wa bg-white px-4 text-sm font-medium text-wa-text hover:bg-green-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
        >
          {busy && confirm?.kind === "all" && <Spinner />}
          ສົ່ງທັງໝົດທີ່ຍັງບໍ່ສົ່ງ ({unsent})
        </button>
        <span className="ml-auto text-sm text-zinc-500">
          ທັງໝົດ <b className="text-zinc-800">{total}</b> ບິນ · ໜ້າ {page}/{lastPage}
          {truncated && " · ສະແດງສູງສຸດ 1000 ບິນ, ເລືອກຊ່ວງວັນທີໃຫ້ສັ້ນລົງ"}
        </span>
      </div>

      {!branch.wa_ready && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
            <WaIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-amber-900">ຍັງບໍ່ໄດ້ເຊື່ອມ WhatsApp ຂອງສາຂາ</p>
            <p className="text-amber-800">ເຊື່ອມກ່ອນ ຈຶ່ງສົ່ງແຈ້ງບິນຫາລູກຄ້າໄດ້. ໃຊ້ເວລາປະມານ 1 ນາທີ.</p>
          </div>
          <Link
            href="/whatsapp"
            className="flex h-9 items-center gap-2 rounded bg-wa px-4 text-sm font-medium text-white hover:brightness-95"
          >
            <WaIcon className="size-4" /> ເຊື່ອມ WhatsApp
          </Link>
        </div>
      )}

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`flex items-start gap-3 rounded px-4 py-2.5 text-sm ${
            notice.tone === "error" ? "bg-hal-soft text-hal-dark" : "bg-green-50 text-green-800"
          }`}
        >
          <p className="flex-1">{notice.text}</p>
          <button onClick={() => setNotice(null)} aria-label="ປິດ" className="leading-none opacity-60 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* ---------- Table ---------- */}
      <section className="relative overflow-hidden rounded-lg bg-white" aria-busy={navigating}>
        {navigating && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-white/60">
            <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-zinc-600 shadow">
              <Spinner className="text-hal" /> ກຳລັງໂຫຼດບິນ…
            </span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-head text-[13px] font-semibold text-zinc-700">
              <tr className="border-b border-line">
                <th className="w-12 px-4 py-4">
                  <input
                    type="checkbox"
                    aria-label="ເລືອກທັງໝົດ"
                    checked={allChecked}
                    onChange={() =>
                      setSelected(allChecked ? new Set() : new Set(sendable.map((b) => b.billNumber)))
                    }
                    className="size-4 accent-hal"
                  />
                </th>
                <th className="px-3 py-4">ລຳດັບ</th>
                <th className="px-3 py-4">ສົ່ງບິນລູກຄ້າ</th>
                <th className="px-3 py-4 text-center">ເບິ່ງລາຍລະອຽດ</th>
                <th className="px-3 py-4">ເບີໂທລະສັບ</th>
                <th className="px-3 py-4">ເບີໂທຜູ້ຝາກ</th>
                <th className="px-3 py-4">ເລກທີບິນ</th>
                <th className="px-3 py-4">ສະຖານະ</th>
                <th className="px-3 py-4">ສາຂາຕົ້ນທາງ</th>
                <th className="px-3 py-4">ສາຂາປາຍທາງ</th>
                <th className="px-3 py-4 text-right">ຄ່າຂົນສົ່ງທັງໝົດ</th>
                <th className="px-3 py-4 text-right">COD</th>
                <th className="px-3 py-4">ວັນທີ</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b, i) => {
                const st = statuses[b.billNumber];
                const { state, reason } = sendState(b, st);
                const badPhone = !!phoneProblem(b.receiverPhone);
                const rowBusy = busy && queuing.has(b.billNumber);
                return (
                  <tr
                    key={b.billNumber}
                    className={`border-b border-line whitespace-nowrap ${
                      flash.has(b.billNumber) ? "row-flash" : ""
                    } ${selected.has(b.billNumber) ? "bg-hal-soft/50" : "hover:bg-head"}`}
                  >
                    <td className="px-4 py-5">
                      <input
                        type="checkbox"
                        checked={selected.has(b.billNumber)}
                        onChange={() => toggle(b.billNumber)}
                        disabled={badPhone}
                        aria-label={b.billNumber}
                        title={badPhone ? `ສົ່ງບໍ່ໄດ້: ${reason}` : undefined}
                        className="size-4 accent-hal disabled:opacity-30"
                      />
                    </td>
                    <td className="px-3 py-5 tabular-nums">{(page - 1) * limit + i + 1}</td>
                    <td className="px-3 py-5">
                      <div className="flex flex-col items-start gap-1">
                        <button
                          onClick={() => sendOne(b)}
                          disabled={busy || badPhone || state === "sending"}
                          className="flex items-center gap-2 font-medium text-wa-text hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline"
                        >
                          {rowBusy ? (
                            <Spinner className="size-5 text-wa" />
                          ) : (
                            <WaIcon className={`size-5 ${badPhone ? "text-zinc-300" : "text-wa"}`} />
                          )}
                          {rowBusy
                            ? "ກຳລັງເຂົ້າຄິວ…"
                            : state === "sent"
                              ? "ສົ່ງຄືນ"
                              : state === "failed" || state === "cannot"
                                ? "ລອງສົ່ງອີກ"
                                : "ສົ່ງບິນລູກຄ້າ"}
                        </button>
                        <StateBadge state={state} reason={reason} message={st} />
                      </div>
                    </td>
                    <td className="px-3 py-5 text-center">
                      <button
                        onClick={() => setDetail(b)}
                        aria-label="ເບິ່ງລາຍລະອຽດ"
                        className="inline-grid h-7 w-8 place-items-center rounded bg-hal text-white hover:bg-hal-dark"
                      >
                        <EyeIcon />
                      </button>
                    </td>
                    <td className={`px-3 py-5 tabular-nums ${badPhone ? "text-hal" : ""}`}>
                      {b.receiverPhone || "—"}
                    </td>
                    <td className="px-3 py-5 tabular-nums">{b.senderPhone ?? "—"}</td>
                    <td className="px-3 py-5 tabular-nums">{b.billNumber}</td>
                    <td className="px-3 py-5">{b.statusText ?? "ຮອດສາຂາ"}</td>
                    <td className="px-3 py-5">{b.startBranch ?? "—"}</td>
                    <td className="px-3 py-5">{b.endBranch ?? "—"}</td>
                    <td className="px-3 py-5 text-right tabular-nums">
                      {b.totalFreight != null ? `${kip.format(b.totalFreight)} ກີບ` : "—"}
                    </td>
                    <td className="px-3 py-5 text-right tabular-nums">
                      {b.codAmount ? (
                        <span className="font-medium text-hal">{kip.format(b.codAmount)} ກີບ</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-5 tabular-nums">{formatArrived(b.arrivedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error ? (
          <p className="p-10 text-center text-sm text-hal">ໂຫຼດບິນບໍ່ໄດ້: {error}</p>
        ) : bills.length === 0 ? (
          <p className="p-10 text-center text-sm text-zinc-500">
            {view.send ? "ບໍ່ມີບິນໃນສະຖານະນີ້" : "ບໍ່ມີບິນໃນຊ່ວງວັນທີນີ້"}
          </p>
        ) : null}

        {total > 0 && (
          <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500">
              <span className="tabular-nums">
                ສະແດງ {(page - 1) * limit + 1}–{Math.min(page * limit, total)} ຈາກ {total} ບິນ
              </span>
              <span className="flex items-center gap-2">
                ຕໍ່ໜ້າ:
                <span className="inline-flex overflow-hidden rounded border border-zinc-300">
                  {PER_PAGE.map((n) => (
                    <button
                      key={n}
                      onClick={() => show({ limit: n, page: 1 })}
                      aria-pressed={n === limit}
                      className={`grid h-8 min-w-10 place-items-center border-l border-zinc-300 px-2 tabular-nums first:border-l-0 ${
                        n === limit ? "bg-hal text-white" : "bg-white text-zinc-700 hover:bg-hal-soft hover:text-hal"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </span>
              </span>
            </div>
            {lastPage > 1 && <Pager page={page} lastPage={lastPage} go={(p) => show({ page: p })} />}
          </div>
        )}
      </section>

      {/* ---------- Confirm send ---------- */}
      <dialog
        ref={confirmRef}
        onClose={() => setConfirm(null)}
        // Esc can't close it while the send is on its way.
        onCancel={(e) => busy && e.preventDefault()}
        className="m-auto w-[min(92vw,30rem)] rounded-lg p-0"
      >
        {confirm && (
          <div className="flex flex-col gap-3 p-5">
            <h2 className="text-lg font-semibold">
              {confirm.kind === "all"
                ? `ສົ່ງທັງໝົດ ${unsent} ບິນທີ່ຍັງບໍ່ສົ່ງ`
                : confirm.kind === "one"
                  ? confirm.resend
                    ? `ສົ່ງຄືນບິນ ${confirm.bills[0]?.billNumber}`
                    : `ສົ່ງບິນ ${confirm.bills[0]?.billNumber}`
                  : `ສົ່ງ ${confirm.bills.length} ບິນທີ່ເລືອກ`}
            </h2>
            {confirm.kind === "all" && (
              <p className="text-sm text-zinc-600">
                ທຸກບິນ {filter.startDate} ຫາ {filter.endDate} (ທຸກໜ້າ, ທຸກສະຖານະ). ບິນທີ່ສົ່ງແລ້ວ
                {counts.cannot ? ` ແລະ ${counts.cannot} ບິນທີ່ສົ່ງບໍ່ໄດ້` : ""} ຈະຖືກຂ້າມ.
              </p>
            )}
            {confirm.resend && (
              <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                ບິນນີ້ສົ່ງແລ້ວ. ລູກຄ້າຈະໄດ້ຮັບຂໍ້ຄວາມຊ້ຳ.
              </p>
            )}
            {confirm.bills[0] && (
              <>
                <p className="text-xs text-zinc-500">
                  ຕົວຢ່າງຂໍ້ຄວາມ ({confirm.bills[0].billNumber} → {confirm.bills[0].receiverPhone}):
                </p>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-[#dcf8c6] p-3 font-sans text-sm">
                  {preview(confirm.bills[0])}
                </pre>
              </>
            )}
            <div className="flex justify-end gap-2">
              <button
                disabled={busy}
                onClick={() => setConfirm(null)}
                className="rounded border border-zinc-300 px-4 py-1.5 text-sm disabled:opacity-50"
              >
                ຍົກເລີກ
              </button>
              <button
                disabled={busy}
                onClick={() => run(confirm)}
                className="flex min-w-32 items-center justify-center gap-2 rounded bg-wa px-4 py-1.5 text-sm font-medium text-white disabled:opacity-80"
              >
                {busy ? <Spinner /> : <WaIcon className="size-4" />} {busy ? "ກຳລັງສົ່ງ…" : "ຢືນຢັນສົ່ງ"}
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* ---------- Connect WhatsApp first ---------- */}
      <dialog ref={connectRef} className="m-auto w-[min(92vw,26rem)] rounded-lg p-0">
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-green-50 text-wa">
            <WaIcon className="size-7" />
          </span>
          <h2 className="text-lg font-semibold">ເຊື່ອມ WhatsApp ກ່ອນສົ່ງບິນ</h2>
          <p className="text-sm text-zinc-600">
            ສາຂານີ້ຍັງບໍ່ໄດ້ເຊື່ອມ WhatsApp, ຈຶ່ງຍັງສົ່ງແຈ້ງບິນບໍ່ໄດ້. ສະແກນ QR ດ້ວຍໂທລະສັບຂອງສາຂາ
            ແລ້ວກັບມາສົ່ງໄດ້ທັນທີ.
          </p>
          <div className="mt-2 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={() => connectRef.current?.close()}
              className="h-9 rounded border border-zinc-300 px-4 text-sm"
            >
              ໄວ້ທີຫຼັງ
            </button>
            <Link
              href="/whatsapp"
              className="flex h-9 items-center justify-center gap-2 rounded bg-wa px-4 text-sm font-medium text-white hover:brightness-95"
            >
              <WaIcon className="size-4" /> ໄປເຊື່ອມ WhatsApp
            </Link>
          </div>
        </div>
      </dialog>

      {/* ---------- Bill detail ---------- */}
      <dialog
        ref={detailRef}
        onClose={() => setDetail(null)}
        className="m-auto w-[min(92vw,34rem)] rounded-lg p-0"
      >
        {detail && (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">ບິນ {detail.billNumber}</h2>
              <button onClick={() => setDetail(null)} aria-label="ປິດ" className="text-xl leading-none text-zinc-400 hover:text-hal">
                ×
              </button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-zinc-500">ຜູ້ຮັບ</dt>
              <dd>{detail.receiverName ?? "—"} · {detail.receiverPhone ?? "—"}</dd>
              <dt className="text-zinc-500">ຜູ້ຝາກ</dt>
              <dd>{detail.senderName ?? "—"} · {detail.senderPhone ?? "—"}</dd>
              <dt className="text-zinc-500">ເສັ້ນທາງ</dt>
              <dd>{detail.startBranch ?? "—"} → {detail.endBranch ?? "—"}</dd>
              <dt className="text-zinc-500">ການຈ່າຍ</dt>
              <dd>
                {PAY_LABEL[detail.payType ?? ""] ?? detail.payType ?? "—"}
                {detail.codAmount ? ` · COD ${kip.format(detail.codAmount)} ກີບ` : ""}
              </dd>
              <dt className="text-zinc-500">ຄ່າຂົນສົ່ງ</dt>
              <dd>{detail.totalFreight != null ? `${kip.format(detail.totalFreight)} ກີບ` : "—"}</dd>
              <dt className="text-zinc-500">ນ້ຳໜັກ / ຂະໜາດ</dt>
              <dd>{detail.weightKg ?? "—"} kg · {detail.sizeCm ?? "—"} cm</dd>
              <dt className="text-zinc-500">ຮອດສາຂາ</dt>
              <dd>{formatArrived(detail.arrivedAt)}</dd>
              <dt className="text-zinc-500">ສົ່ງ WhatsApp</dt>
              <dd>
                <StateBadge {...sendState(detail, statuses[detail.billNumber])} message={statuses[detail.billNumber]} />
              </dd>
              <dt className="text-zinc-500">Tracking</dt>
              <dd>{detail.trackingId ?? "—"}</dd>
            </dl>
            <div>
              <p className="mb-1 text-xs text-zinc-500">ຂໍ້ຄວາມທີ່ຈະສົ່ງ:</p>
              <pre className="whitespace-pre-wrap rounded-lg bg-[#dcf8c6] p-3 font-sans text-sm">{preview(detail)}</pre>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const b = detail;
                  setDetail(null);
                  sendOne(b);
                }}
                disabled={!!phoneProblem(detail.receiverPhone)}
                className="flex items-center gap-2 rounded bg-wa px-4 py-1.5 text-sm font-medium text-white disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                <WaIcon className="size-4" /> ສົ່ງບິນລູກຄ້າ
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

const STATE_DOT: Record<SendState, string> = {
  not_sent: "bg-zinc-400",
  sending: "bg-amber-500",
  sent: "bg-wa",
  cannot: "bg-hal",
  failed: "bg-orange-500",
};

const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

function StateBadge({
  state,
  reason,
  message,
}: {
  state: SendState;
  reason: string | null;
  message: LatestMessage | undefined;
}) {
  // Sent bills keep the detailed WhatsApp ticks.
  if ((state === "sent" || state === "sending") && message) return <MessageBadge status={message.status} />;
  if (state === "cannot") {
    return <span className={`${pill} bg-hal-soft text-hal-dark`}>ສົ່ງບໍ່ໄດ້: {reason}</span>;
  }
  if (state === "failed") {
    return (
      <span title={reason ?? undefined} className={`${pill} bg-orange-100 text-orange-800`}>
        ສົ່ງບໍ່ສຳເລັດ
      </span>
    );
  }
  return <span className={`${pill} bg-zinc-100 text-zinc-500`}>ຍັງບໍ່ສົ່ງ</span>;
}

function Pager({ page, lastPage, go }: { page: number; lastPage: number; go: (p: number) => void }) {
  // First, last, and two either side of the current page.
  const pages = [...new Set([1, lastPage, page - 2, page - 1, page, page + 1, page + 2])]
    .filter((p) => p >= 1 && p <= lastPage)
    .sort((a, b) => a - b);

  const cls = "grid h-8 min-w-8 place-items-center rounded border px-2 text-sm";
  return (
    <nav className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
      {page > 1 && (
        <button onClick={() => go(page - 1)} aria-label="ໜ້າກ່ອນ" className={`${cls} border-zinc-300 hover:border-hal hover:text-hal`}>
          ‹
        </button>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1] > 1 && <span className="text-zinc-400">…</span>}
          <button
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${cls} ${p === page ? "border-hal bg-hal text-white" : "border-zinc-300 hover:border-hal hover:text-hal"}`}
          >
            {p}
          </button>
        </span>
      ))}
      {page < lastPage && (
        <button onClick={() => go(page + 1)} aria-label="ໜ້າຖັດໄປ" className={`${cls} border-zinc-300 hover:border-hal hover:text-hal`}>
          ›
        </button>
      )}
    </nav>
  );
}

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91A9.85 9.85 0 0 0 12.04 2Zm5.8 14.13c-.25.69-1.44 1.32-2 1.4-.51.08-1.16.11-1.87-.12-.43-.14-.98-.32-1.69-.62-2.97-1.28-4.91-4.27-5.06-4.47-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.6-.37.8-.37h.57c.18 0 .43-.07.67.51.25.6.84 2.06.92 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.77 1.27 1.65 2.05 1.13 1.01 2.09 1.32 2.39 1.47.3.15.47.12.65-.07.17-.2.74-.87.94-1.17.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.35.07.12.07.72-.18 1.41Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
      <path d="M12 5C6.5 5 2.7 9.1 1.5 12c1.2 2.9 5 7 10.5 7s9.3-4.1 10.5-7C21.3 9.1 17.5 5 12 5Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden className="size-4">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" strokeLinecap="round" />
    </svg>
  );
}
