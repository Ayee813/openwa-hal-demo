import { Suspense } from "react";
import { AppHeader, HeaderSkeleton } from "@/components/app-header";
import { WaBadge } from "@/components/badges";
import { requireBranch } from "@/lib/auth";

const NAV = [
  { href: "/branch", label: "ລາຍການບິນ" },
  { href: "/branch/scan", label: "ສະແກນເຄື່ອງເຂົ້າ" },
  { href: "/branch/whatsapp", label: "WhatsApp" },
];

export default function BranchLayout({ children }: LayoutProps<"/branch">) {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <BranchHeader />
      </Suspense>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
        {children}
      </main>
    </>
  );
}

async function BranchHeader() {
  const { profile, branch } = await requireBranch();
  return (
    <AppHeader
      title={`ສາຂາ ${branch.name}`}
      subtitle={profile.full_name}
      nav={NAV}
      right={<WaBadge status={branch.wa_status} />}
    />
  );
}
