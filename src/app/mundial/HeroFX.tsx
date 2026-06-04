import styles from "./Shell.module.css";

/**
 * Capa decorativa del hero: confeti celeste/oro/blanco cayendo + orbes de luz
 * (clima de final del Mundial de noche). Es puramente estética (aria-hidden, sin
 * interacción). Las posiciones son DETERMINISTAS (índice, no random) → mismo
 * markup en server y cliente, sin mismatch de hidratación. Bajo
 * prefers-reduced-motion el CSS oculta toda la capa (.fx → display:none).
 */

const COLORS = ["Gold", "Celeste", "White", "GoldDeep", "Celeste"] as const;

const PIECES = Array.from({ length: 24 }, (_, i) => ({
  left: (i * 41 + 7) % 100,
  delay: -(((i * 0.83) % 9)).toFixed(2),
  dur: 7 + (i % 6),
  size: 6 + (i % 4) * 2,
  color: COLORS[i % COLORS.length],
  round: i % 3 === 0,
  drift: (i % 2 === 0 ? 1 : -1) * (16 + (i % 5) * 8),
}));

export default function HeroFX() {
  return (
    <div className={styles.fx} aria-hidden="true">
      <span className={`${styles.orb} ${styles.orbA}`} />
      <span className={`${styles.orb} ${styles.orbB}`} />
      <span className={`${styles.orb} ${styles.orbC}`} />
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`${styles.confetti} ${styles[`c${p.color}`]} ${p.round ? styles.confettiRound : ""}`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.9,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
