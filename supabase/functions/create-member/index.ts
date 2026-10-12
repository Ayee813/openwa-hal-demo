import { withSupabase } from "npm:@supabase/server@1.9.1";

import type { Database } from "../_shared/db.ts";
import { fail, isResponse, json, readJson, requireRole } from "../_shared/http.ts";

interface Body {
  email: string;
  password: string;
  full_name: string;
  role?: "admin" | "branch";
  /** Required for a branch account: the HAL branch id it belongs to. */
  branch_id?: number;
}

/**
 * Creates a staff account (admin, or branch tied to one HAL branch). Admin only.
 *
 * The caller's role comes from `profiles` via their own RLS-scoped client — the
 * `role` field in the body only decides what the *new* account gets.
 */
const createMember = {
  fetch: withSupabase<Database>(
    { auth: "user" },
    async (req: Request, ctx): Promise<Response> => {
      const caller = await requireRole(ctx, "admin");
      if (isResponse(caller)) return caller;

      const body = await readJson<Body>(req);
      if (!body?.email || !body?.password || !body?.full_name) {
        return fail("email, password and full_name are required");
      }
      if (body.password.length < 8) {
        return fail("Password must be at least 8 characters");
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
        return fail("Invalid email");
      }

      const role = body.role === "admin" ? "admin" : "branch";
      const branchId = role === "branch" ? Number(body.branch_id) : null;
      if (role === "branch") {
        if (!Number.isInteger(branchId)) return fail("branch_id is required for a branch account");
        const { data: branch } = await ctx.supabase
          .from("branches")
          .select("id")
          .eq("id", branchId!)
          .maybeSingle();
        if (!branch) return fail("Unknown branch");
      }

      // Creating an auth user genuinely requires the secret key.
      const { data: created, error: createError } =
        await ctx.supabaseAdmin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
          user_metadata: { full_name: body.full_name },
        });

      if (createError || !created?.user) {
        const duplicate = /already/i.test(createError?.message ?? "");
        return fail(
          duplicate
            ? "That email is already in use"
            : `Creating the account failed: ${createError?.message}`,
          duplicate ? 409 : 500,
        );
      }

      const { error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .insert({
          id: created.user.id,
          role,
          full_name: body.full_name,
          email: body.email,
          is_active: true,
          branch_id: branchId,
        });

      if (profileError) {
        // An auth user with no profile can sign in but lands nowhere — undo it.
        await ctx.supabaseAdmin.auth.admin.deleteUser(created.user.id);
        return fail(`Creating the profile failed: ${profileError.message}`, 500);
      }

      return json(
        { id: created.user.id, email: body.email, role, branch_id: branchId },
        201,
      );
    },
  ),
};

export default createMember;
