import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Branch, Profile, UserRole } from "@/lib/types";

/**
 * The signed-in profile, or null. `cache()` makes it one query per request no
 * matter how many components ask.
 *
 * Identity comes from `getClaims()` (local JWT verification); the profile row
 * is read live so `is_active` takes effect on the next navigation rather than
 * when the token expires.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const userId = error ? null : data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return profile ?? null;
});

/** Loads the profile and enforces it is active (and, optionally, its role). */
export async function requireProfile(role?: UserRole): Promise<Profile> {
  const profile = await getProfile();

  if (!profile) redirect("/login?error=no_profile");
  if (!profile.is_active) redirect("/login?error=inactive");
  if (role && profile.role !== role) redirect(homeFor(profile.role));

  return profile;
}

/**
 * A branch account together with its branch row. An account whose branch was
 * removed (branch_id null) is sent back to sign-in rather than shown an empty
 * page.
 */
export async function requireBranch(): Promise<{
  profile: Profile;
  branch: Branch;
}> {
  const profile = await requireProfile("branch");
  if (profile.branch_id == null) redirect("/login?error=no_branch");

  const supabase = await createClient();
  const { data: branch } = await supabase
    .from("branches")
    .select("*")
    .eq("id", profile.branch_id)
    .maybeSingle();

  if (!branch) redirect("/login?error=no_branch");
  return { profile, branch };
}

/** Where each role lands after sign-in. */
export function homeFor(role: UserRole): "/admin" | "/branch" {
  return role === "admin" ? "/admin" : "/branch";
}
