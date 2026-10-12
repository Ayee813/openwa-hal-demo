/**
 * Environment validation.
 *
 * The failure this exists to prevent: `NEXT_PUBLIC_*` variables are inlined at
 * *build* time. Build the image without them and the app deploys perfectly
 * happily, then every sign-in fails with "Failed to fetch" because the client
 * was compiled with `undefined` as the Supabase URL. That is a miserable thing
 * to debug from a browser console at 9pm.
 *
 * Importing this module throws at build/boot instead, naming the variable.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. ` +
        `Copy .env.example to .env.local (or set it in your host's dashboard) ` +
        `and rebuild, NEXT_PUBLIC_* values are baked in at build time.`,
    );
  }
  return value.trim();
}

function url(name: string, value: string): string {
  try {
    new URL(value);
  } catch {
    throw new Error(
      `Environment variable ${name} is not a valid URL: ${value}`,
    );
  }
  return value.replace(/\/$/, "");
}

/** Safe in the browser. Everything reachable with these is governed by RLS. */
export const publicEnv = {
  supabaseUrl: url(
    "NEXT_PUBLIC_SUPABASE_URL",
    required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  ),
  supabasePublishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};
