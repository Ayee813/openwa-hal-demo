import { redirect } from "next/navigation";
import { Suspense } from "react";
import { homeFor, requireProfile } from "@/lib/auth";

export default function Home() {
  return (
    <Suspense fallback={<p className="p-8 text-zinc-500">ກຳລັງໂຫຼດ…</p>}>
      <RoleRedirect />
    </Suspense>
  );
}

async function RoleRedirect(): Promise<null> {
  const profile = await requireProfile();
  redirect(homeFor(profile.role));
}
