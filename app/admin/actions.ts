"use server";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { toLaoMsisdn } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type FormState = { ok?: string; error?: string };

async function functionError(error: Error): Promise<string> {
  return error instanceof FunctionsHttpError
    ? ((await error.context.json().catch(() => null))?.error ?? error.message)
    : error.message;
}

/**
 * Sends a saved HAL API response to the `import-shipments` Edge Function.
 *
 * The files in data/ are raw HTTP captures (status line + headers + JSON), so
 * everything before the first `{` or `[` is dropped.
 */
export async function importShipments(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile("admin");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "ເລືອກໄຟລ໌ກ່ອນ" };
  }

  const text = await file.text();
  const start = text.search(/[[{]/);
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(start >= 0 ? text.slice(start) : text);
  } catch {
    return { error: "ໄຟລ໌ນີ້ບໍ່ມີ JSON ທີ່ຖືກຕ້ອງ" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{
    imported: number;
    branches: number;
    skipped: number[];
  }>("import-shipments", { body: payload });

  if (error) return { error: await functionError(error) };

  revalidatePath("/admin", "layout");
  return {
    ok: `ນຳເຂົ້າ ${data?.imported ?? 0} ບິນ, ${data?.branches ?? 0} ສາຂາ${
      data?.skipped.length ? `, ຂ້າມ ${data.skipped.length}` : ""
    }`,
  };
}

// ---------------------------------------------------------------------------
// Branches and accounts
// ---------------------------------------------------------------------------

const newUser = z.object({
  email: z.email().max(320),
  password: z.string().min(8, "ລະຫັດຜ່ານຢ່າງໜ້ອຍ 8 ຕົວ").max(200),
  full_name: z.string().trim().min(1, "ໃສ່ຊື່").max(120),
  role: z.enum(["admin", "branch"]),
  branch_id: z.coerce.number().int().positive().optional(),
});

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireProfile("admin");

  const parsed = newUser.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    branch_id: formData.get("branch_id") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };
  if (parsed.data.role === "branch" && !parsed.data.branch_id) {
    return { error: "ເລືອກສາຂາໃຫ້ບັນຊີ branch" };
  }

  const supabase = await createClient();
  const { error } = await supabase.functions.invoke("create-member", { body: parsed.data });
  if (error) return { error: await functionError(error) };

  revalidatePath("/admin/branches");
  return { ok: `ສ້າງບັນຊີ ${parsed.data.email} ແລ້ວ` };
}

export async function setUserActive(id: string, active: boolean): Promise<FormState> {
  const me = await requireProfile("admin");
  if (id === me.id) return { error: "ປິດບັນຊີຕົນເອງບໍ່ໄດ້" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", id);
  revalidatePath("/admin/branches");
  return error ? { error: error.message } : {};
}

const branchFields = z.object({
  name: z.string().trim().min(1, "ໃສ່ຊື່ສາຂາ").max(120),
  tel: z.string().trim().max(30),
  district: z.string().trim().max(120),
  staff_phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || toLaoMsisdn(v) !== null, "ເບີພະນັກງານບໍ່ຖືກຕ້ອງ"),
  pickup_days: z.coerce.number().int().min(1).max(60),
  daily_limit: z.coerce.number().int().min(1).max(2000),
  auto_send: z.boolean(),
  wa_session_id: z.string().trim().max(64),
});

function readBranch(formData: FormData) {
  return branchFields.safeParse({
    name: formData.get("name"),
    tel: formData.get("tel") ?? "",
    district: formData.get("district") ?? "",
    staff_phone: formData.get("staff_phone") ?? "",
    pickup_days: formData.get("pickup_days") ?? 7,
    daily_limit: formData.get("daily_limit") ?? 200,
    auto_send: formData.get("auto_send") === "on",
    wa_session_id: formData.get("wa_session_id") ?? "",
  });
}

export async function saveBranch(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireProfile("admin");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "ລະຫັດສາຂາ (HAL id) ຕ້ອງເປັນຕົວເລກ" };

  const parsed = readBranch(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };

  const d = parsed.data;
  const row = {
    id,
    name: d.name,
    tel: d.tel || null,
    district: d.district || null,
    staff_phone: d.staff_phone || null,
    pickup_days: d.pickup_days,
    daily_limit: d.daily_limit,
    auto_send: d.auto_send,
    wa_session_id: d.wa_session_id || null,
    ...(d.wa_session_id ? {} : { wa_status: "not_connected", wa_phone: null, wa_name: null }),
  };

  const supabase = await createClient();
  const { error } = await supabase.from("branches").upsert(row, { onConflict: "id" });
  if (error) {
    return {
      error: /wa_session_id/.test(error.message)
        ? "Session WhatsApp ນີ້ຖືກໃຊ້ກັບສາຂາອື່ນແລ້ວ"
        : error.message,
    };
  }

  revalidatePath("/admin", "layout");
  return { ok: `ບັນທຶກສາຂາ ${d.name} ແລ້ວ` };
}

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------

export async function saveTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireProfile("admin");

  const key = formData.get("key");
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  if (key !== "arrival" && key !== "reminder") return { error: "ແມ່ແບບບໍ່ຖືກຕ້ອງ" };
  if (!body || body.length > 4000) return { error: "ຂໍ້ຄວາມຕ້ອງມີ 1–4000 ຕົວອັກສອນ" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("message_templates")
    .upsert({ key, body, updated_by: me.id, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath("/admin/template");
  return { ok: "ບັນທຶກແມ່ແບບແລ້ວ" };
}
