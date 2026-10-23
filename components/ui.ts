/**
 * Shared class names for the HAL Admin look (tokens in app/globals.css), so
 * cards, fields and buttons match from page to page.
 */

export const card = "rounded-lg bg-white";

export const cardHead = "flex items-center justify-between gap-3 border-b border-line px-5 py-3.5";

export const field =
  "h-9 w-full rounded border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-hal focus:ring-2 focus:ring-hal/15 disabled:bg-zinc-50";

export const hint = "text-xs text-zinc-500";

const btnBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const btn = {
  primary: `${btnBase} bg-hal text-white hover:bg-hal-dark`,
  wa: `${btnBase} bg-wa text-white hover:brightness-95`,
  outline: `${btnBase} border border-zinc-300 bg-white text-zinc-700 hover:border-hal hover:text-hal`,
};

export const alert = {
  error: "rounded bg-red-50 px-3 py-2 text-sm text-red-700",
  warn: "rounded bg-amber-50 px-3 py-2 text-sm text-amber-900",
  ok: "rounded bg-green-50 px-3 py-2 text-sm text-green-800",
};
