import "server-only";

/**
 * Minimal client for the OpenWA gateway (~/openwa/OpenWA, docker
 * `openwa-api` on 127.0.0.1:2785).
 *
 * Only Next.js server code may call it: the gateway listens on localhost, which
 * Supabase Edge Functions cannot reach, and the API key controls every
 * WhatsApp session on the box.
 */

export type SessionStatus =
  | "created"
  | "initializing"
  | "qr_ready"
  | "authenticating"
  | "ready"
  | "disconnected"
  | "action_required"
  | "failed";

export type WaSession = {
  id: string;
  name: string;
  status: SessionStatus;
  phone: string | null;
  pushName: string | null;
  lastError?: string | null;
};

export type WaMessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export class OpenWAError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function config() {
  const url = process.env.OPENWA_URL?.replace(/\/$/, "");
  const key = process.env.OPENWA_API_KEY;
  if (!url || !key) {
    throw new OpenWAError("OPENWA_URL and OPENWA_API_KEY must be set in .env.local", 500);
  }
  return { url, key };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = config();

  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      ...init,
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(30_000),
      headers: {
        "X-API-Key": key,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (e) {
    throw new OpenWAError(
      `ເຊື່ອມຕໍ່ OpenWA ບໍ່ໄດ້ (${url}): ${e instanceof Error ? e.message : e}`,
      503,
    );
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body
        ? [body.message].flat().join(", ")
        : text) || res.statusText;
    throw new OpenWAError(String(message), res.status);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const enc = encodeURIComponent;

export const openwa = {
  listSessions: () => call<WaSession[]>("/api/sessions"),

  getSession: (id: string) => call<WaSession>(`/api/sessions/${enc(id)}`),

  createSession: (name: string) =>
    call<WaSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  startSession: (id: string) =>
    call<unknown>(`/api/sessions/${enc(id)}/start`, { method: "POST" }),

  logout: (id: string) =>
    call<unknown>(`/api/sessions/${enc(id)}/logout`, { method: "POST" }),

  getQr: (id: string) =>
    call<{ qrCode: string; status: SessionStatus }>(`/api/sessions/${enc(id)}/qr`),

  checkNumber: (id: string, msisdn: string) =>
    call<{ exists: boolean; whatsappId: string | null }>(
      `/api/sessions/${enc(id)}/contacts/check/${enc(msisdn)}`,
    ),

  sendText: (id: string, chatId: string, text: string) =>
    call<{ messageId: string; timestamp: number }>(
      `/api/sessions/${enc(id)}/messages/send-text`,
      { method: "POST", body: JSON.stringify({ chatId, text }) },
    ),

  /** The gateway's stored copy of one sent message, for its delivery status. */
  async messageStatus(
    id: string,
    chatId: string,
    waMessageId: string,
  ): Promise<WaMessageStatus | null> {
    const q = new URLSearchParams({
      chatId,
      messageId: waMessageId,
      limit: "1",
      inlineMedia: "false",
    });
    const res = await call<{ messages: { status?: WaMessageStatus }[] }>(
      `/api/sessions/${enc(id)}/messages?${q}`,
    );
    return res.messages[0]?.status ?? null;
  },
};

/** Session name OpenWA uses for a branch. */
export function branchSessionName(branchId: number) {
  return `hal-branch-${branchId}`;
}
