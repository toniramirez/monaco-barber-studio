"use client";

import styles from "./Shell.module.css";
import { useNowMs } from "@/lib/prode/clock";

/**
 * Cuenta regresiva en vivo, estilo marcador de cancha.
 * - `compact`: oculta el segmento "días" cuando es 0 (útil para ventanas cortas, ej. cooldown de 2 h).
 * - `zero`: qué renderizar al llegar a 0 (por defecto, el aviso del cierre del Mundial).
 * - `ariaLabel`: etiqueta accesible (por defecto, el cierre del prode).
 */
export default function Countdown({
  target,
  compact = false,
  zero,
  ariaLabel = "Cuenta regresiva para el cierre del prode",
}: {
  target: string;
  compact?: boolean;
  zero?: React.ReactNode;
  ariaLabel?: string;
}) {
  const now = useNowMs();
  const diff = now === null ? null : Math.max(0, new Date(target).getTime() - now);

  if (diff === 0) {
    return <>{zero ?? <div className={styles.kickoff}>¡Arrancó el Mundial!</div>}</>;
  }

  const d = diff === null ? 0 : Math.floor(diff / 86400000);
  const h = diff === null ? 0 : Math.floor((diff % 86400000) / 3600000);
  const m = diff === null ? 0 : Math.floor((diff % 3600000) / 60000);
  const s = diff === null ? 0 : Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  // [valor, etiqueta, ¿acento celeste?]
  const segs: [string, string, boolean][] = [];
  if (!(compact && d === 0)) segs.push([String(d), "días", false]);
  segs.push([pad(h), "hs", false], [pad(m), "min", false], [pad(s), "seg", true]);

  return (
    <div
      className={styles.scoreboard}
      role="timer"
      aria-label={ariaLabel}
    >
      {segs.map(([val, unit, accent]) => (
        <div className={styles.sbSeg} key={unit}>
          <div className={`${styles.sbBox} ${accent ? styles.sbBoxAccent : ""}`}>
            <span className={styles.sbNum}>{now === null ? "––" : val}</span>
          </div>
          <span className={styles.sbUnit}>{unit}</span>
        </div>
      ))}
    </div>
  );
}
