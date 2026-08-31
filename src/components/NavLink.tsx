"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className="rounded-sm px-1 py-0.5 transition-colors hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
    >
      {children}
    </Link>
  );
}
