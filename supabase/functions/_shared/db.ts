/**
 * The Edge Functions share the Next.js app's database types rather than keeping
 * a second copy that can drift. Type-only, so it is erased at bundle time — the
 * deployed function carries no runtime dependency outside `supabase/`.
 */
export type { Database, UserRole } from "../../../lib/types.ts";
