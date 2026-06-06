import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import shell from "./Shell.module.css";
import TabBar from "./TabBar";
import LeagueInviteCapture from "./LeagueInviteCapture";

export const metadata: Metadata = {
  title: "Prode Mundial 2026 | Monaco Barber Studio",
  description:
    "El Prode de Monaco. Jugá gratis el prode del Mundial 2026, sumá fichas y ganá cortes.",
};

/**
 * App-shell del Prode: barra superior slim + barra inferior de tabs (Inicio,
 * Jugar, Tabla, Mi cuenta). Cada ruta hija renderiza su pantalla dentro de
 * <main className={shell.content}/>. Layout anidado: NO incluye html/body.
 */
export default function MundialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={shell.shell}>
      <header className={shell.topbar}>
        <Link href="/mundial" className={shell.brand}>
          <Image src="/logo.jpeg" alt="Monaco" width={28} height={28} className={shell.brandLogo} />
          <span>MONACO</span>
          <span className={shell.brandBadge}>PRODE</span>
          <span className={shell.liveDot} aria-hidden="true" />
        </Link>
        <Link href="/" className={shell.topbarLink}>
          <ChevronLeft size={15} /> Sitio
        </Link>
      </header>

      <Suspense fallback={null}>
        <LeagueInviteCapture />
      </Suspense>

      {children}

      <TabBar />
    </div>
  );
}
