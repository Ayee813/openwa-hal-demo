#!/usr/bin/env node
/**
 * Read-only check of the HAL `holding-shipments` API: which of the fields the
 * WhatsApp message needs are actually present.
 *
 *   HAL_EMAIL=… HAL_PASSWORD=… node scripts/hal-inspect.mjs [start] [end]
 *   (dates YYYY-MM-DD, default: last 7 days)
 *
 * Signs in, GETs one page (up to 50 bills), and writes:
 *   data/hal-holding-report.txt   field coverage + every key path in a row
 *   data/hal-holding-sample.json  2 rows with names, phones and emails masked
 *
 * It never writes to HAL, and never prints or saves the token or password.
 */

import { mkdirSync, writeFileSync } from "node:fs";

const BASE = (process.env.HAL_API_URL ?? "https://hal.hal-logistics.la").replace(/\/$/, "");
const email = process.env.HAL_EMAIL;
const password = process.env.HAL_PASSWORD;
if (!email || !password) {
  console.error("usage: HAL_EMAIL=… HAL_PASSWORD=… node scripts/hal-inspect.mjs [start] [end]");
  process.exit(1);
}

const day = (offset) => new Date(Date.now() + 7 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);
const start = process.argv[2] ?? day(-7);
const end = process.argv[3] ?? day(0);

const headers = {
  Accept: "application/json",
  Origin: "https://haladmin.hal-logistics.la",
  Referer: "https://haladmin.hal-logistics.la/",
};

// --- sign in ---------------------------------------------------------------
const signIn = await fetch(`${BASE}/api/admin/sign-in`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const auth = await signIn.json().catch(() => ({}));
if (!signIn.ok || !auth.access_token) {
  console.error(`sign-in failed: HTTP ${signIn.status}`, typeof auth === "string" ? auth : auth.message ?? "");
  process.exit(1);
}
const user = auth.authUser ?? {};
const branchId = user.branch_id;
console.log(`signed in: branch_id=${branchId} branch=${user.branch?.name ?? "?"} roles=${(auth.roleUser ?? []).join(",")} expires_in=${auth.expires_in}s`);

// --- one page of bills (GET only) -------------------------------------------
const params = new URLSearchParams({
  lang: "la", page: "1", limit: "50", sort_order: "desc", use_paginate: "true",
  branch_id: String(branchId), force_id: "true", start_date: start, end_date: end,
  status: "arrived_status",
});
const res = await fetch(`${BASE}/api/v1/auth/branches/shipments/orders/tracking/holding-shipments?${params}`, {
  headers: { ...headers, Authorization: `Bearer ${auth.access_token}` },
});
const page = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`holding-shipments failed: HTTP ${res.status}`);
  process.exit(1);
}
const rows = page.data ?? [];
console.log(`bills ${start}..${end}: ${rows.length} on page 1, total=${page.total}, last_page=${page.last_page}`);

// --- coverage of the fields the message uses ----------------------------------
const get = (o, path) => path.split(".").reduce((v, k) => (v == null ? v : v[k]), o);
const NEEDED = {
  "bill number":         ["parcel_in_shipment.parcel_bill_number", "shipment.shipment_number"],
  "receiver name":       ["shipment.receiver_customer.name"],
  "receiver phone":      ["shipment.receiver_customer.tel"],
  "sender phone":        ["shipment.sender_customer.tel"],
  "weight":              ["parcel_in_shipment.parcel.weight", "shipment.parcel.weight"],
  "size":                ["parcel_in_shipment.parcel.dimension_length", "shipment.parcel.dimension_length"],
  "pay type":            ["shipment.shipment_pay_type"],
  "freight":             ["shipment.total_freight"],
  "COD amount":          ["shipment.total_price"],
  "status text":         ["shipment.label_status.value", "status", "shipment.name"],
  "arrived at":          ["created_at"],
  "start branch name":   ["shipment.start_branch.name"],
  "start branch tel":    ["shipment.start_branch.tel"],
  "end branch name":     ["shipment.end_branch.name"],
  "end branch tel":      ["shipment.end_branch.tel"],
  "end village":         ["shipment.end_branch.village.name"],
  "end district":        ["shipment.end_branch.village.district.name"],
  "end province":        ["shipment.end_branch.province.name", "shipment.end_branch.village.district.province.name"],
};

const lines = [`HAL holding-shipments ${start}..${end}, ${rows.length} rows (total ${page.total})`, ""];
lines.push("FIELD COVERAGE (rows with a non-empty value / rows)");
for (const [label, paths] of Object.entries(NEEDED)) {
  const hits = paths.map((p) => [p, rows.filter((r) => { const v = get(r, p); return v !== null && v !== undefined && v !== ""; }).length]);
  const best = hits.sort((a, b) => b[1] - a[1])[0];
  const mark = best[1] === rows.length && rows.length ? "OK  " : best[1] ? "SOME" : "NONE";
  lines.push(`  ${mark} ${label.padEnd(18)} ${String(best[1]).padStart(3)}/${rows.length}  ${best[0]}`);
}

// Every key path with its type, from all rows (no values).
const shape = new Map();
const walk = (v, path) => {
  if (Array.isArray(v)) { shape.set(path, "array"); v.slice(0, 3).forEach((x) => walk(x, `${path}[]`)); return; }
  if (v && typeof v === "object") { for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k); return; }
  if (!shape.has(path) || shape.get(path) === "null") shape.set(path, v === null ? "null" : typeof v);
};
rows.forEach((r) => walk(r, ""));
lines.push("", "ALL KEY PATHS IN A ROW (type only, no values)");
for (const [p, t] of [...shape].sort()) lines.push(`  ${p}: ${t}`);

// --- masked sample -----------------------------------------------------------
const SENSITIVE = /(^|_)(name|surname|tel|phone|email|address|id_card|password|token)$/i;
const mask = (v, key) => {
  if (Array.isArray(v)) return v.map((x) => mask(x, key));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mask(x, k)]));
  if (typeof v === "string" && SENSITIVE.test(key) && !/branch|province|district|village|category/i.test(key)) {
    return v.length <= 3 ? "***" : `${v.slice(0, 2)}***${v.slice(-2)}`;
  }
  return v;
};
// Customer names are masked; branch/place names stay so the address can be checked.
const sample = rows.slice(0, 2).map((r) => {
  const m = mask(r, "");
  for (const who of ["sender_customer", "receiver_customer"]) {
    const c = m.shipment?.[who];
    if (c) for (const k of ["name", "surname", "tel"]) if (typeof c[k] === "string") c[k] = c[k] ? `${c[k].slice(0, 2)}***` : c[k];
  }
  return m;
});

mkdirSync("data", { recursive: true });
writeFileSync("data/hal-holding-report.txt", lines.join("\n") + "\n");
writeFileSync("data/hal-holding-sample.json", JSON.stringify({ total: page.total, last_page: page.last_page, data: sample }, null, 2) + "\n");
console.log(lines.slice(2, 3 + Object.keys(NEEDED).length).join("\n"));
console.log("\nwrote data/hal-holding-report.txt and data/hal-holding-sample.json (names/phones masked)");
