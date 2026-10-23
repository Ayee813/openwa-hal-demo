import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { HalError } from "@/lib/hal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Branch } from "@/lib/types";

/**
 * The signed-in HAL user, kept in one httpOnly cookie encrypted with
 * AES-256-GCM. The HAL access token lives inside it, so JavaScript in the page
 * can never read it, and a tampered cookie fails to decrypt.
 */

export const SESSION_COOKIE = "hal_session";

export type Session = {
  token: string;
  /** Unix ms when the HAL token expires. */
  exp: number;
  userId: string;
  name: string;
  email: string;
  branchId: number;
  branchName: string;
  roles: string[];
  /** The development account: mock bills from demo_bills, no HAL token. */
  demo?: boolean;
};

/**
 * The development account from .env.local, or null when it is turned off.
 * Leave DEV_LOGIN_EMAIL empty in production and the account does not exist.
 */
export function devAccount(): { email: string; password: string } | null {
  const email = process.env.DEV_LOGIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEV_LOGIN_PASSWORD;
  return email && password ? { email, password } : null;
}

/** Constant-time compare, so a wrong password can't be guessed by timing. */
export function samePassword(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set in .env.local (at least 32 characters)");
  }
  return createHash("sha256").update(secret).digest();
}

export function seal(session: Session): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

function unseal(value: string): Session | null {
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(json) as Session;
  } catch {
    return null;
  }
}

export const getSession = cache(async (): Promise<Session | null> => {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  // The expiry check reads the clock, so it must run at request time.
  await connection();
  const session = value ? unseal(value) : null;
  if (!session || session.exp <= Date.now()) return null;
  // A demo cookie stops working as soon as the dev account is turned off.
  if (session.demo && !devAccount()) return null;
  return session;
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login?error=expired");
  return session;
}

/** HAL no longer accepts the token: back to the login page. */
export function redirectIfSignedOut(e: unknown) {
  if (e instanceof HalError && e.status === 401) redirect("/login?error=expired");
}

/** The session plus this branch's row (WhatsApp session, settings). */
export async function requireBranch(): Promise<{ session: Session; branch: Branch }> {
  const session = await requireSession();
  const db = createAdminClient();
  const { data: branch } = await db
    .from("branches")
    .select("*")
    .eq("id", session.branchId)
    .maybeSingle();
  if (!branch) redirect("/login?error=no_branch");
  return { session, branch };
}
