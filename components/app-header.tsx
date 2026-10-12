import { signOut } from "@/app/(auth)/actions";
import { NavLinks, type NavItem } from "./nav-links";

export function AppHeader({
  title,
  subtitle,
  nav,
  right,
}: {
  title: string;
  subtitle: string;
  nav: NavItem[];
  right?: React.ReactNode;
}) {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-red-600 text-sm font-bold text-white">
            HAL
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-zinc-500">{subtitle}</p>
          </div>
        </div>
        <NavLinks items={nav} />
        <div className="ml-auto flex items-center gap-3">
          {right}
          <form action={signOut}>
            <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
              ອອກຈາກລະບົບ
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function HeaderSkeleton() {
  return (
    <header className="h-[57px] border-b border-zinc-200 dark:border-zinc-800" />
  );
}
