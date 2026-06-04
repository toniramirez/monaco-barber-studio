"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, Trophy, User } from "lucide-react";
import shell from "./Shell.module.css";

const TABS = [
  { href: "/mundial", label: "Inicio", Icon: Home },
  { href: "/mundial/jugar", label: "Jugar", Icon: Ticket },
  { href: "/mundial/tabla", label: "Tabla", Icon: Trophy },
  { href: "/mundial/cuenta", label: "Mi cuenta", Icon: User },
] as const;

/** Barra inferior estilo app. El tab activo se deriva del pathname. */
export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className={shell.tabbar} aria-label="Navegación del Prode">
      {TABS.map(({ href, label, Icon }) => {
        // "/mundial" sólo coincide exacto; el resto, exacto o con subrutas.
        const active = href === "/mundial" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`${shell.tab} ${active ? shell.tabActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className={shell.tabIcon}>
              <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
            </span>
            <span className={shell.tabLabel}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
