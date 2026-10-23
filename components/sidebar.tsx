"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { WaBadge } from "./badges";

type Item = { href: string; label: string; icon: React.ReactNode; soon?: boolean };

const NAV: { title: string; items: Item[] }[] = [
  {
    title: "ຈັດການບິນ",
    items: [
      { href: "/bills", label: "ເຄື່ອງຮອດສາຂາ", icon: <BoxIcon /> },
      { href: "/scan", label: "ສະແກນເຄື່ອງເຂົ້າ", icon: <ScanIcon />, soon: true },
    ],
  },
  {
    title: "ຕັ້ງຄ່າ",
    items: [{ href: "/whatsapp", label: "WhatsApp ສາຂາ", icon: <ChatIcon /> }],
  },
];

export function Sidebar({
  branchName,
  userName,
  waStatus,
  demo,
}: {
  branchName: string;
  userName: string;
  waStatus: string;
  /** Development account with mock bills. */
  demo: boolean;
}) {
  const pathname = usePathname();
  // The drawer remembers the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Image src="/hal-logo.png" alt="HAL Express" width={42} height={42} priority />
        <div className="leading-tight">
          <p className="font-semibold">HAL Express</p>
          <p className="text-xs text-zinc-500">ແຈ້ງບິນ WhatsApp</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
              {group.title}
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const cls = `relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
                  active
                    ? "bg-hal-soft font-semibold text-hal before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-r before:bg-hal"
                    : item.soon
                      ? "cursor-not-allowed text-zinc-400"
                      : "text-zinc-700 hover:bg-zinc-100 hover:text-hal"
                }`;
                return (
                  <li key={item.href}>
                    {item.soon ? (
                      <span className={cls} title="ກຳລັງພັດທະນາ">
                        {item.icon}
                        {item.label}
                        <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-normal">
                          ໄວໆນີ້
                        </span>
                      </span>
                    ) : (
                      <Link href={item.href} className={cls}>
                        {item.icon}
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-4">
        <div className="mb-3 rounded-md bg-head p-3">
          {demo && (
            <p className="mb-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
              DEV · ຂໍ້ມູນທົດລອງ
            </p>
          )}
          <p className="truncate text-sm font-semibold">ສາຂາ {branchName}</p>
          <p className="mb-1.5 truncate text-xs text-zinc-500">{userName}</p>
          <Link href="/whatsapp" className="hover:underline">
            <WaBadge status={waStatus} />
          </Link>
        </div>
        <form action={signOut}>
          <button className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white py-2 text-sm hover:border-hal hover:text-hal">
            <LogoutIcon /> ອອກຈາກລະບົບ
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white px-4 py-2.5 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="ເປີດເມນູ"
          className="grid size-9 place-items-center rounded-md border border-zinc-300"
        >
          <MenuIcon />
        </button>
        <Image src="/hal-logo.png" alt="" width={32} height={32} />
        <p className="truncate text-sm font-semibold">ສາຂາ {branchName}</p>
        <span className="ml-auto">
          <WaBadge status={waStatus} />
        </span>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-white lg:block">
        {panel}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="ປິດເມນູ" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">{panel}</aside>
        </div>
      )}
    </>
  );
}

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-5 shrink-0">
      {children}
    </svg>
  );
}

function BoxIcon() {
  return (
    <Svg>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </Svg>
  );
}

function ScanIcon() {
  return (
    <Svg>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
    </Svg>
  );
}

function ChatIcon() {
  return (
    <Svg>
      <path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5Z" />
    </Svg>
  );
}

function LogoutIcon() {
  return (
    <Svg>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
    </Svg>
  );
}

function MenuIcon() {
  return (
    <Svg>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  );
}
