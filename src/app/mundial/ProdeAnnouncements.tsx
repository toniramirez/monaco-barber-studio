"use client";

/* ════════════════════════════════════════════════════════════════════════
   ANUNCIO DEL PRODE (cliente) — popup "Se abre el Desafío 2".
   Se muestra UNA sola vez por dispositivo (localStorage). El gate (server)
   decide si D2 está vigente; acá decidimos si ya se vio. SSR-safe: nada de
   localStorage en render (sólo dentro de effects). prefers-reduced-motion ok.
   a11y: foco al abrir + trap + restaurar, role=dialog en el panel, Escape cierra.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Sparkles, PartyPopper } from "lucide-react";
import shell from "./Shell.module.css";
import styles from "./ProdeAnnouncements.module.css";

const SEEN_D2 = "prode:seen:d2_open:v1";

type Props = {
  d2Active: boolean;
  registered: boolean;
  /** Slug del play del Desafío 2 (CTA del popup). */
  d2Slug: string;
};

function hasSeen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function markSeen(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* modo incógnito / storage bloqueado: el anuncio puede repetir, no rompe */
  }
}

/** Focusables dentro de un contenedor (para el focus-trap del modal). */
function focusablesIn(el: HTMLElement | null): HTMLElement[] {
  if (!el) return [];
  return Array.from(
    el.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'),
  ).filter((n) => !n.hasAttribute("disabled"));
}

export default function ProdeAnnouncements({ d2Active, registered, d2Slug }: Props) {
  const rm = useReducedMotion();
  const [show, setShow] = useState(false);
  const started = useRef(false);
  // Foco: panel activo + elemento a restaurar al cerrar (el modal se auto-abre).
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // En mount: mostrar si D2 está vigente y no se vio aún (localStorage es client-only).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (d2Active && !hasSeen(SEEN_D2)) {
      // Necesariamente en effect: depende de localStorage (en SSR rompería hidratación).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(true);
    }
  }, [d2Active]);

  // Bloquear scroll de fondo mientras el modal está abierto.
  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  // Foco: al abrir, recordar el foco previo y moverlo al panel; al cerrar, restaurar.
  useEffect(() => {
    if (!show) return;
    prevFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const t = window.setTimeout(
      () => {
        const [first] = focusablesIn(panelRef.current);
        first?.focus();
      },
      rm ? 0 : 60,
    );
    return () => {
      window.clearTimeout(t);
      prevFocusRef.current?.focus?.();
    };
  }, [show, rm]);

  const dismiss = useCallback(() => {
    markSeen(SEEN_D2);
    setShow(false);
  }, []);

  // Escape cierra.
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, dismiss]);

  // Focus-trap: Tab/Shift+Tab cicla dentro del panel (no se escapa al fondo).
  const trapTab = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const f = focusablesIn(panelRef.current);
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    const activeEl = document.activeElement;
    if (e.shiftKey && activeEl === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && activeEl === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const overlayMotion = rm
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.25 },
      };
  const sheetMotion = rm
    ? { initial: false as const, animate: { opacity: 1, scale: 1, y: 0 } }
    : {
        initial: { opacity: 0, scale: 0.9, y: 24 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.94, y: 16 },
        transition: { type: "spring" as const, stiffness: 320, damping: 26 },
      };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="d2"
          className={styles.overlay}
          {...overlayMotion}
          onClick={dismiss}
          onKeyDown={trapTab}
        >
          {!rm && <Confetti />}
          <motion.div
            ref={panelRef}
            className={styles.imgSheet}
            {...sheetMotion}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Se abre el Desafío 2"
          >
            <button type="button" className={styles.close} onClick={dismiss} aria-label="Cerrar">
              <X size={18} aria-hidden="true" />
            </button>
            <div className={styles.imgFrame}>
              <Image
                src="/popup_d2.jpeg"
                alt="Se abre el Desafío 2 — segundos partidos de la fase de grupos"
                width={1122}
                height={1402}
                className={styles.img}
                sizes="(max-width: 420px) 90vw, 360px"
              />
              <span className={styles.imgFade} aria-hidden="true" />
            </div>
            <div className={styles.imgActions}>
              <Link
                href={registered ? `/mundial/jugar/${d2Slug}` : "/mundial/jugar"}
                className={shell.btnPrimary}
                onClick={dismiss}
              >
                <PartyPopper size={18} aria-hidden="true" /> Jugar el Desafío 2
              </Link>
              <button type="button" className={shell.btnGhost} onClick={dismiss}>
                <Sparkles size={15} aria-hidden="true" /> Más tarde
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Confeti decorativo: piezas deterministas (sin random en render → SSR-safe). */
function Confetti() {
  const pieces = useMemo(() => {
    const cols = [styles.cGold, styles.cCeleste, styles.cWhite];
    return Array.from({ length: 26 }, (_, i) => {
      const left = (i * 37 + 7) % 100;
      const delay = ((i * 53) % 100) / 50; // 0–2s
      const dur = 2 + ((i * 29) % 100) / 60; // ~2–3.7s
      const round = i % 3 === 0;
      const col = cols[i % cols.length];
      return { i, left, delay, dur, round, col };
    });
  }, []);
  return (
    <div className={styles.confetti} aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.i}
          className={`${styles.piece} ${p.round ? styles.pieceRound : ""} ${p.col}`}
          style={{
            left: `${p.left}%`,
            ["--delay" as string]: `${p.delay}s`,
            ["--dur" as string]: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
