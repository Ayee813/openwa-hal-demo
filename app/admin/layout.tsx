import { Suspense } from "react";
import { AppHeader, HeaderSkeleton } from "@/components/app-header";
import { requireProfile } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "ພາບລວມ" },
  { href: "/admin/bills", label: "ບິນທັງໝົດ" },
  { href: "/admin/branches", label: "ສາຂາ & ຜູ້ໃຊ້" },
  { href: "/admin/messages", label: "ປະຫວັດຂໍ້ຄວາມ" },
  { href: "/admin/template", label: "ແມ່ແບບຂໍ້ຄວາມ" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <AdminHeader />
      </Suspense>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
        {children}
      </main>
    </>
  );
}

async function AdminHeader() {
  const profile = await requireProfile("admin");
  return (
    <AppHeader title="HAL Express · Admin" subtitle={profile.full_name} nav={NAV} />
  );
}
