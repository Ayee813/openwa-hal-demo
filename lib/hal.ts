import "server-only";

import type { Bill } from "@/lib/bill";

/**
 * Client for the HAL admin API (the system staff already sign in to at
 * haladmin.hal-logistics.la). Called from the Next.js server only: the access
 * token never reaches the browser.
 *
 * Response shapes are typed loosely: only the fields read below matter, and
 * HAL may add or drop others.
 */

const BASE = (process.env.HAL_API_URL ?? "https://hal.hal-logistics.la").replace(/\/$/, "");

export class HalError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type HalAuthUser = {
  userId?: string | number;
  userName?: string;
  userEmail?: string;
  branch_id?: number | string | null;
  branch?: { id?: number; name?: string; tel?: string } | null;
};

export type HalSignIn = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  authUser?: HalAuthUser;
  roleUser?: string[];
};

type HalCustomer = { name?: string | null; surname?: string | null; tel?: string | null };
type HalBranch = {
  name?: string | null;
  tel?: string | null;
  village?: {
    name?: string | null;
    district?: { name?: string | null; province?: { name?: string | null } | null } | null;
  } | null;
  province?: { name?: string | null } | null;
};

type HalHoldingRow = {
  tracking_id?: string | number | null;
  created_at?: string | null;
  status?: string | null;
  shipment?: {
    shipment_number?: string | null;
    shipment_pay_type?: string | null;
    total_freight?: number | string | null;
    total_price?: number | string | null;
    name?: string | null;
    label_status?: { value?: string | null } | null;
    sender_customer?: HalCustomer | null;
    receiver_customer?: HalCustomer | null;
    start_branch?: HalBranch | null;
    end_branch?: HalBranch | null;
  } | null;
  parcel_in_shipment?: {
    parcel_bill_number?: string | null;
    parcel?: { weight?: number | string | null; dimension_length?: number | string | null } | null;
  } | null;
};

export type HalPage = {
  data?: HalHoldingRow[];
  current_page?: number;
  last_page?: number;
  total?: number;
};

const HEADERS = {
  Accept: "application/json",
  // HAL's own admin front end sends these; mirror them as the test script does.
  Origin: "https://haladmin.hal-logistics.la",
  Referer: "https://haladmin.hal-logistics.la/",
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
      headers: { ...HEADERS, ...init.headers },
    });
  } catch (e) {
    throw new HalError(`ເຊື່ອມຕໍ່ລະບົບ HAL ບໍ່ໄດ້: ${(e as Error).message}`, 503);
  }

  const body = (await res.json().catch(() => null)) as { message?: string } | string | null;
  if (!res.ok) {
    // Errors come back either as a bare JSON string or as { message }.
    const message = typeof body === "string" ? body : body?.message;
    // A rejected or revoked token can come back as 401, 419 or 403 with an
    // "Unauthenticated" / token message; treat them all as signed out.
    const signedOut =
      res.status === 401 ||
      res.status === 419 ||
      (res.status === 403 && /unauth|token|login|expired/i.test(message ?? ""));
    throw new HalError(message || `HAL HTTP ${res.status}`, signedOut ? 401 : res.status);
  }
  return body as T;
}

export function signIn(email: string, password: string) {
  return request<HalSignIn>("/api/admin/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export type HoldingQuery = {
  branchId: number;
  page: number;
  limit: number;
  startDate: string;
  endDate: string;
  /** "arrived_status" for parcels waiting at the branch, "" for all. */
  status: string;
};

/** One page of bills held at the branch. */
export async function holdingPage(token: string, q: HoldingQuery) {
  const params = new URLSearchParams({
    lang: "la",
    page: String(q.page),
    limit: String(q.limit),
    sort_order: "desc",
    use_paginate: "true",
    branch_id: String(q.branchId),
    force_id: "true",
    start_date: q.startDate,
    end_date: q.endDate,
  });
  if (q.status) params.set("status", q.status);

  const page = await request<HalPage>(
    `/api/v1/auth/branches/shipments/orders/tracking/holding-shipments?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return {
    bills: (page.data ?? []).map(toBill).filter((b): b is Bill => b !== null),
    page: page.current_page ?? q.page,
    lastPage: page.last_page ?? 1,
    total: page.total ?? 0,
  };
}

/**
 * Every bill for a date range, page by page, up to `max`. Used for search and
 * "send all", so the server works from HAL's data rather than trusting a list
 * of numbers or phones from the browser.
 */
export async function holdingAll(
  token: string,
  q: Omit<HoldingQuery, "page" | "limit">,
  max = 1000,
): Promise<{ bills: Bill[]; truncated: boolean }> {
  const bills: Bill[] = [];
  for (let page = 1; ; page++) {
    const res = await holdingPage(token, { ...q, page, limit: 50 });
    bills.push(...res.bills);
    if (bills.length >= max) return { bills: bills.slice(0, max), truncated: true };
    if (page >= res.lastPage || res.bills.length === 0) return { bills, truncated: false };
  }
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function name(c: HalCustomer | null | undefined): string | null {
  const n = [c?.name, c?.surname].filter(Boolean).join(" ").trim();
  return n || null;
}

function toBill(r: HalHoldingRow): Bill | null {
  const sh = r.shipment ?? {};
  const pis = r.parcel_in_shipment ?? {};
  const billNumber = pis.parcel_bill_number || sh.shipment_number;
  if (!billNumber) return null;

  const payType = sh.shipment_pay_type ?? null;
  return {
    billNumber,
    trackingId: r.tracking_id != null ? String(r.tracking_id) : null,
    statusText: sh.label_status?.value ?? r.status ?? sh.name ?? null,
    receiverName: name(sh.receiver_customer),
    receiverPhone: sh.receiver_customer?.tel ?? null,
    senderName: name(sh.sender_customer),
    senderPhone: sh.sender_customer?.tel ?? null,
    startBranch: sh.start_branch?.name ?? null,
    startBranchTel: sh.start_branch?.tel ?? null,
    endBranch: sh.end_branch?.name ?? null,
    endBranchTel: sh.end_branch?.tel ?? null,
    endVillage: sh.end_branch?.village?.name ?? null,
    endDistrict: sh.end_branch?.village?.district?.name ?? null,
    endProvince:
      sh.end_branch?.province?.name ?? sh.end_branch?.village?.district?.province?.name ?? null,
    payType,
    totalFreight: num(sh.total_freight),
    codAmount: payType?.endsWith("_cod") ? num(sh.total_price) : null,
    weightKg: num(pis.parcel?.weight),
    sizeCm: num(pis.parcel?.dimension_length),
    arrivedAt: r.created_at ?? null,
  };
}
