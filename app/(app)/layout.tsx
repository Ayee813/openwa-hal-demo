import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { requireBranch } from "@/lib/session";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:pl-64">
      <Suspense fallback={<SidebarSkeleton />}>
        <AppSidebar />
      </Suspense>
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 lg:p-6">
        {children}
      </main>
    </div>
  );
}

async function AppSidebar() {
  const { session, branch } = await requireBranch();
  return (
    <Sidebar
      branchName={branch.name || session.branchName}
      userName={session.name}
      waStatus={branch.wa_session_id ? branch.wa_status : "not_connected"}
      demo={session.demo ?? false}
    />
  );
}

function SidebarSkeleton() {
  return (
    <>
      <div className="h-[57px] border-b border-line bg-white lg:hidden" />
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block" />
    </>
  );
}
