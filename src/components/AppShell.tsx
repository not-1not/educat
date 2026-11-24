"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

type NavItem = { href: string; label: string; icon: IconName };

// Enam menu utama dipakai di bottom bar HP. Pengaturan ada di sidebar dan header HP.
export const adminNav: NavItem[] = [
  { href: "/admin", label: "Ringkasan", icon: "dashboard" },
  { href: "/admin/siswa", label: "Siswa", icon: "users" },
  { href: "/admin/soal", label: "Soal", icon: "book" },
  { href: "/admin/token", label: "Token", icon: "key" },
  { href: "/admin/monitoring", label: "Monitor", icon: "monitor" },
  { href: "/admin/hasil", label: "Hasil", icon: "chart" },
];

const settingsItem: NavItem = {
  href: "/admin/pengaturan",
  label: "Pengaturan",
  icon: "settings",
};

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AppShell({
  children,
  schoolName,
  email,
}: {
  children: React.ReactNode;
  schoolName: string;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/masuk");
    router.refresh();
  }

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar: ikon saja di tablet, penuh di laptop (≥1024 px). */}
      <aside className="glass-panel hidden md:sticky md:top-0 md:flex md:h-dvh md:shrink-0 md:flex-col md:border-r md:border-slate-200 md:w-20 lg:w-64 print:hidden">
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-brand-700 to-orange-300 text-sm font-bold text-white shadow-sm">
            E
          </div>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-base font-bold text-slate-900">EduCAT</p>
            <p className="truncate text-xs text-slate-500">{schoolName}</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Menu utama">
          {[...adminNav, settingsItem].map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={`touch-target flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                  active
                    ? "bg-brand-700 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                <span className="hidden lg:inline">{item.label === "Monitor" ? "Monitoring" : item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-2">
          <p className="hidden truncate px-3 pb-1 text-xs text-slate-500 lg:block">{email}</p>
          <button
            type="button"
            onClick={logout}
            title="Keluar"
            className="touch-target flex w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Icon name="logout" className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">Keluar</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header ringkas di HP. */}
        <header className="glass-panel sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-2 md:hidden print:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 via-brand-700 to-orange-300 text-sm font-bold text-white shadow-sm">
              E
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">EduCAT</p>
              <p className="truncate text-[11px] leading-tight text-slate-500">{schoolName}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <Link
              href="/admin/pengaturan"
              aria-label="Pengaturan"
              className="touch-target flex items-center justify-center rounded-xl text-slate-600"
            >
              <Icon name="settings" />
            </Link>
            <button
              type="button"
              onClick={logout}
              aria-label="Keluar"
              className="touch-target flex items-center justify-center rounded-xl text-slate-600"
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>

        <main className="w-full flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Bottom bar untuk HP (<768 px). */}
      <nav
        aria-label="Menu utama HP"
        className="glass-panel fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-6">
          {adminNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
                    active ? "text-brand-700" : "text-slate-500"
                  }`}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
