"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { HalError, signIn as halSignIn } from "@/lib/hal";
import { DEMO_BRANCH } from "@/lib/demo";
import { SESSION_COOKIE, devAccount, samePassword, seal, type Session } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const credentials = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
});

export interface SignInState {
  error?: string;
}

/**
 * Signs in with the staff member's HAL account. The HAL token is stored only
 * inside the encrypted httpOnly session cookie.
 */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "ກະລຸນາໃສ່ອີເມວ ແລະ ລະຫັດຜ່ານ" };

  // The development account never reaches HAL, not even with a wrong password.
  const dev = devAccount();
  if (dev && parsed.data.email.toLowerCase() === dev.email) {
    if (!samePassword(parsed.data.password, dev.password)) {
      return { error: "ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" };
    }
    return startDemoSession(dev.email);
  }

  let res;
  try {
    res = await halSignIn(parsed.data.email, parsed.data.password);
  } catch (e) {
    if (e instanceof HalError && (e.status === 401 || e.status === 422 || e.status === 400)) {
      return { error: "ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" };
    }
    return { error: (e as Error).message };
  }

  const user = res.authUser ?? {};
  const branchId = Number(user.branch_id);
  if (!res.access_token) return { error: "ລະບົບ HAL ບໍ່ໄດ້ສົ່ງ token ກັບມາ" };
  if (!Number.isInteger(branchId) || branchId <= 0 || branchId === DEMO_BRANCH.id) {
    return { error: "ບັນຊີນີ້ບໍ່ໄດ້ຢູ່ສາຂາໃດ (ບໍ່ມີ branch_id) ຈຶ່ງສົ່ງບິນບໍ່ໄດ້" };
  }

  // HAL tokens carry their own lifetime; cap the cookie at 12 hours.
  const ttl = Math.min(res.expires_in ?? 12 * 3600, 12 * 3600);
  const branchName = user.branch?.name ?? `ສາຂາ #${branchId}`;
  const session: Session = {
    token: res.access_token,
    exp: Date.now() + ttl * 1000,
    userId: String(user.userId ?? ""),
    name: user.userName || user.userEmail || parsed.data.email,
    email: user.userEmail || parsed.data.email,
    branchId,
    branchName,
    roles: res.roleUser ?? [],
  };

  // Our own per-branch row (WhatsApp session, settings). Only the name is
  // refreshed from HAL; settings staff changed here are kept.
  const db = createAdminClient();
  const { error } = await db
    .from("branches")
    .upsert(
      { id: branchId, name: branchName, ...(user.branch?.tel ? { tel: user.branch.tel } : {}) },
      { onConflict: "id" },
    );
  if (error) return { error: `ບັນທຶກສາຂາບໍ່ໄດ້: ${error.message}` };

  await setSession(session, ttl);
  redirect("/bills");
}

/** Signs in to the demo branch, whose bills come from demo_bills. */
async function startDemoSession(email: string): Promise<SignInState> {
  // Created once; settings changed on the WhatsApp page are kept.
  const { error } = await createAdminClient()
    .from("branches")
    .upsert(DEMO_BRANCH, { onConflict: "id", ignoreDuplicates: true });
  if (error) return { error: `ບັນທຶກສາຂາບໍ່ໄດ້: ${error.message}` };

  const ttl = 12 * 3600;
  await setSession(
    {
      token: "",
      exp: Date.now() + ttl * 1000,
      userId: "dev",
      name: "ຜູ້ພັດທະນາ (DEV)",
      email,
      branchId: DEMO_BRANCH.id,
      branchName: DEMO_BRANCH.name,
      roles: [],
      demo: true,
    },
    ttl,
  );
  redirect("/bills");
}

async function setSession(session: Session, ttl: number) {
  (await cookies()).set(SESSION_COOKIE, seal(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttl,
  });
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
