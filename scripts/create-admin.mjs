#!/usr/bin/env node
/**
 * Creates (or repairs) a staff account directly against a Supabase project.
 *
 * This is the hosted-project counterpart to `supabase/seed.sql`, which only ever
 * runs on the local stack. It goes through the Auth admin API rather than
 * writing password hashes into `auth.users`, so it is safe against production.
 *
 * Idempotent: run it again to reset the password, rename, or fix a missing
 * profile row.
 *
 *   ADMIN_EMAIL=someone@example.com \
 *   ADMIN_PASSWORD='...' \
 *   ADMIN_NAME='Their Name' \
 *   node scripts/create-admin.mjs
 *
 * Reads SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 * from .env.local. The password is never defaulted — it must be passed in.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // Environment may be supplied by the host instead.
  }
}

loadEnvLocal();

const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const secret =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_NAME ?? email;
const role = process.env.ADMIN_ROLE ?? "admin";
// For ADMIN_ROLE=branch: the HAL branch id the account belongs to.
const branchId = process.env.ADMIN_BRANCH_ID ? Number(process.env.ADMIN_BRANCH_ID) : null;

function die(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

if (!base || !secret) die("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
if (!email) die("ADMIN_EMAIL is required");
if (!password) die("ADMIN_PASSWORD is required (it is never defaulted)");
if (password.length < 8) die("ADMIN_PASSWORD must be at least 8 characters");
if (!["admin", "branch"].includes(role)) die("ADMIN_ROLE must be admin or branch");
if (role === "branch" && !Number.isInteger(branchId)) die("ADMIN_BRANCH_ID is required for ADMIN_ROLE=branch");

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "content-type": "application/json",
};

async function findUserByEmail(address) {
  // The admin list endpoint filters server-side, so this stays one request even
  // on a project with many users.
  const res = await fetch(
    `${base}/auth/v1/admin/users?filter=${encodeURIComponent(address)}&per_page=200`,
    { headers },
  );
  if (!res.ok) die(`listing users failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return (body.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === address.toLowerCase(),
  );
}

async function main() {
  let user = await findUserByEmail(email);

  if (user) {
    const res = await fetch(`${base}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }),
    });
    if (!res.ok) die(`updating user failed: ${res.status} ${await res.text()}`);
    console.log(`auth    updated existing user ${email}`);
  } else {
    const res = await fetch(`${base}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }),
    });
    if (!res.ok) die(`creating user failed: ${res.status} ${await res.text()}`);
    user = await res.json();
    console.log(`auth    created ${email}`);
  }

  const profile = {
    id: user.id,
    role,
    full_name: fullName,
    email,
    is_active: true,
    branch_id: role === "branch" ? branchId : null,
  };

  const res = await fetch(`${base}/rest/v1/profiles`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(profile),
  });

  if (!res.ok) die(`writing profile failed: ${res.status} ${await res.text()}`);

  console.log(`profile ${role}  ${fullName}`);
  console.log(`id      ${user.id}`);
  console.log("done.");
}

main().catch((e) => die(e.message));
