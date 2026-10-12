import type { SupabaseContext } from "npm:@supabase/server@1.9.1";

import type { Database, UserRole } from "./db.ts";

export type Ctx = SupabaseContext<Database>;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Error shape every function returns, so the UI can render one message path. */
export function fail(message: string, status = 400, extra?: unknown): Response {
  return json({ error: message, ...(extra ? { detail: extra } : {}) }, status);
}

/**
 * Reads the caller's role from `profiles` with their own RLS-scoped client.
 * Never trust a role sent in the request body or in JWT metadata.
 */
export async function requireRole(
  ctx: Ctx,
  role: UserRole,
): Promise<{ id: string } | Response> {
  const userId = ctx.userClaims?.id;
  if (!userId) return fail("Not signed in", 401);

  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!data || !data.is_active) return fail("Account is not active", 403);
  if (data.role !== role) return fail("Not allowed", 403);

  return { id: data.id };
}

export function isResponse(v: unknown): v is Response {
  return v instanceof Response;
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
