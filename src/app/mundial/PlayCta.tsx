"use client";

/* ════════════════════════════════════════════════════════════════════════
   CTA del hub "Jugar": el botón grande "Jugar" (lleva al Desafío activo) +
   "Jugar con amigos", que abre una hoja para CREAR una liga privada con el
   nombre que el jugador quiera (no "Liga de Fulano" forzado). Reusa el server
   action createLeague/joinLeague y comparte el link con ?liga=CODE.
   SSR-safe (confeti determinista), reduced-motion respetado, foco/Escape ok.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Swords,
  Users,
  X,
  PartyPopper,
  Share2,
  Trophy,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import shell from "./Shell.module.css";
import styles from "./PlayCta.module.css";
import { createLeague, joinLeague } from "./actions";

type Props = {
  /** Destino del botón "Jugar" (Desafío activo o la Gran Quiniela). */
  playHref: string;
  /** Texto del botón principal ("Jugar" / "Ver mi Prode" si ya cerró). */
  playLabel: string;
  /** Nombre del jugador — sólo para el placeholder/default de la liga. */
  displayName: string;
};

// Confeti determinista por índice (SSR-safe) para el éxito "liga creada".
const BURST_COLORS = ["cGold", "cCeleste", "cWhite", "cGoldDeep"] as const;
const BURST = Array.from({ length: 16 }, (_, i) => ({
  left: 14 + ((i * 11) % 72),
  bx: (i % 2 ? 1 : -1) * (20 + ((i * 19) % 130)),
  by: 130 + ((i * 13) % 120),
  delay: ((i % 5) * 0.04).toFixed(2),
  color: BURST_COLORS[i % BURST_COLORS.length],
}));

export default function PlayCta({ playHref, playLabel, displayName }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinedMsg, setJoinedMsg] = useState<string | null>(null);

  // Cerrar con Escape mientras la hoja está abierta.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  function onCreate() {
    setError(null);
    setJoinedMsg(null);
    setPending(true);
    const chosen = name.trim() || `Liga de ${displayName || "amigos"}`;
    createLeague(chosen)
      .then((r) => {
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setCreated({ name: chosen, code: r.data.inviteCode });
      })
      .catch(() => setError("Algo falló, probá de nuevo."))
      .finally(() => setPending(false));
  }

  function onJoin() {
    if (!joinCode.trim()) return;
    setError(null);
    setJoinedMsg(null);
    setPending(true);
    joinLeague(joinCode.trim())
      .then((r) => {
        setJoinedMsg(r.ok ? `¡Te uniste a "${r.data.name}"!` : null);
        if (!r.ok) setError(r.error);
      })
      .catch(() => setError("Algo falló, probá de nuevo."))
      .finally(() => setPending(false));
  }

  function share() {
    if (!created) return;
    const base = window.location.origin;
    const url = `${base}/mundial?liga=${created.code}`;
    const text = `Te reto en el Prode Mundial de Monaco. Sumate a mi liga "${created.name}" y ganá cortes:`;
    if (navigator.share) {
      navigator.share({ title: "Prode Monaco", text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  function copyCode() {
    if (!created) return;
    navigator.clipboard?.writeText(created.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <div className={styles.cta}>
        <Link href={playHref} className={`${shell.btnPrimary} ${styles.playBtn}`}>
          <Swords size={19} aria-hidden="true" /> {playLabel}
        </Link>
        <button
          type="button"
          className={`${shell.btnGhost} ${styles.friendsBtn}`}
          onClick={() => setOpen(true)}
        >
          <Users size={18} aria-hidden="true" /> Jugar con amigos
        </button>
      </div>

      {open && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Jugar con amigos"
          onClick={close}
        >
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.close} aria-label="Cerrar" onClick={close}>
              <X size={18} />
            </button>

            {!created ? (
              <>
                <span className={styles.sheetIcon} aria-hidden="true">
                  <Users size={26} />
                </span>
                <h3 className={styles.sheetTitle}>Jugá con amigos</h3>
                <p className={styles.sheetSub}>
                  Creá tu liga privada y competí en una tabla aparte. Vos le ponés el nombre.
                </p>

                <div className={shell.field}>
                  <label className={shell.label} htmlFor="liga-name">
                    Nombre de tu liga
                  </label>
                  <input
                    id="liga-name"
                    className={shell.input}
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 60))}
                    placeholder="Los cracks del barrio"
                    maxLength={60}
                    autoFocus
                  />
                </div>

                <button
                  type="button"
                  className={shell.btnPrimary}
                  onClick={onCreate}
                  disabled={pending || !name.trim()}
                >
                  {pending ? "Creando…" : <>Crear liga <ChevronRight size={18} aria-hidden="true" /></>}
                </button>

                <div className={styles.or} aria-hidden="true">
                  <span>o</span>
                </div>

                <div className={styles.joinRow}>
                  <input
                    className={shell.input}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 16))}
                    placeholder="Código de liga"
                    aria-label="Código de liga para unirte"
                  />
                  <button
                    type="button"
                    className={shell.btnGhost}
                    onClick={onJoin}
                    disabled={pending || !joinCode.trim()}
                  >
                    Unirme
                  </button>
                </div>

                {joinedMsg && (
                  <p className={`${shell.helper} ${styles.okMsg}`} role="status">
                    {joinedMsg}
                  </p>
                )}
                {error && (
                  <p className={shell.error} role="alert">
                    {error}
                  </p>
                )}
              </>
            ) : (
              <div className={styles.done}>
                <div className={shell.burst} aria-hidden="true">
                  {BURST.map((p, i) => (
                    <span
                      key={i}
                      className={`${shell.burstPiece} ${shell[p.color]}`}
                      style={{
                        left: `${p.left}%`,
                        animationDelay: `${p.delay}s`,
                        ["--bx" as string]: `${p.bx}px`,
                        ["--by" as string]: `${p.by}px`,
                      }}
                    />
                  ))}
                </div>
                <span className={styles.sheetIcon} aria-hidden="true">
                  <PartyPopper size={26} />
                </span>
                <h3 className={styles.sheetTitle}>¡Liga creada!</h3>
                <p className={styles.sheetSub}>
                  <strong className={styles.leagueName}>{created.name}</strong> ya está lista.
                  Compartí el código y que se sumen tus amigos.
                </p>

                <button
                  type="button"
                  className={styles.codeBox}
                  onClick={copyCode}
                  aria-label={`Copiar el código de la liga ${created.code}`}
                >
                  <span className={styles.codeVal}>{created.code}</span>
                  <span className={styles.codeCopy}>
                    {copied ? (
                      <>
                        <Check size={14} aria-hidden="true" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy size={14} aria-hidden="true" /> Copiar
                      </>
                    )}
                  </span>
                </button>

                <button type="button" className={shell.btnPrimary} onClick={share}>
                  <Share2 size={18} aria-hidden="true" /> Invitar amigos
                </button>
                <Link href="/mundial/tabla" className={shell.btnGhost}>
                  <Trophy size={16} aria-hidden="true" /> Ver la tabla de mi liga
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
