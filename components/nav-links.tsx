"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // The longest matching prefix wins, so /branch does not stay lit on /branch/scan.
  const active = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`rounded-md px-3 py-1.5 text-sm ${
            i.href === active
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
