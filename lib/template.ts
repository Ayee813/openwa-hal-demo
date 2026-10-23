import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { Branch } from "@/lib/types";

/**
 * The arrival message a branch sends: its own wording if staff wrote one on
 * the WhatsApp page, otherwise the shared template.
 */
export async function arrivalTemplate(
  branch: Pick<Branch, "arrival_template">,
  db: ReturnType<typeof createAdminClient>,
): Promise<{ body: string; shared: string; custom: boolean }> {
  const { data } = await db.from("message_templates").select("body").eq("key", "arrival").maybeSingle();
  const shared = data?.body ?? "";
  const own = branch.arrival_template?.trim();
  return { body: own || shared, shared, custom: Boolean(own) };
}
