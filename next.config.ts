import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * The Supabase origin has to be in `connect-src` or the browser blocks every
 * auth and data call. A build without the variable would emit a policy that
 * silently breaks sign-in, so refuse to build instead.
 */
function supabaseOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local " +
        "and fill it in — it is inlined at build time and required for the " +
        "Content-Security-Policy connect-src directive.",
    );
  }

  return new URL(raw).origin;
}

const origin = supabaseOrigin();

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${origin}`,
  `media-src 'self' blob: ${origin}`,
  "font-src 'self' data:",
  // wss:// too — Supabase Realtime uses it.
  `connect-src 'self' ${origin} ${origin.replace(/^http/, "ws")}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  experimental: {
    agentFeedback: true,
    // The shipments importer posts the raw HAL API response (a few hundred KB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // The scan page opens the camera; nothing else may.
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // API responses are scoped to one signed-in user by RLS.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
