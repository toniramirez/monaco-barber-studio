import shell from "../Shell.module.css";
import styles from "./Tabla.module.css";

/**
 * Skeleton de la Tabla: encabezado + podio falso (3 columnas escalonadas) +
 * unas filas placeholder. Se muestra mientras el Server Component trae el
 * ranking. Sin animación de marca (solo el shimmer del propio skeleton).
 */
export default function TablaLoading() {
  return (
    <main className={shell.content} aria-busy="true">
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={shell.sectionTitle}>
            Tabla <span className={shell.em}>general</span>
          </h1>
          <span className={shell.liveDot} aria-hidden="true" />
        </div>
        <div className={`${styles.skel} ${styles.skelLine}`} style={{ width: "80%" }} />
        <div className={styles.metaRow}>
          <div className={`${styles.skel} ${styles.skelPill}`} />
          <div className={`${styles.skel} ${styles.skelPill}`} />
        </div>
      </header>

      {/* Podio falso */}
      <div className={styles.podium} aria-hidden="true">
        <div className={styles.slot}>
          <div className={`${styles.skel} ${styles.skelAvatar}`} />
          <div className={`${styles.skel} ${styles.skelLine}`} style={{ width: "70%", marginTop: "0.7rem" }} />
          <div className={`${styles.skel} ${styles.pedestal} ${styles.silver}`} />
        </div>
        <div className={`${styles.slot} ${styles.slotFirst}`}>
          <div className={`${styles.skel} ${styles.skelAvatar} ${styles.skelAvatarBig}`} />
          <div className={`${styles.skel} ${styles.skelLine}`} style={{ width: "75%", marginTop: "0.7rem" }} />
          <div className={`${styles.skel} ${styles.pedestal} ${styles.gold}`} />
        </div>
        <div className={styles.slot}>
          <div className={`${styles.skel} ${styles.skelAvatar}`} />
          <div className={`${styles.skel} ${styles.skelLine}`} style={{ width: "70%", marginTop: "0.7rem" }} />
          <div className={`${styles.skel} ${styles.pedestal} ${styles.bronze}`} />
        </div>
      </div>

      {/* Filas falsas */}
      <div className={styles.list} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className={styles.row} key={i}>
            <div className={`${styles.skel} ${styles.skelRank}`} />
            <div className={`${styles.skel} ${styles.skelLine}`} style={{ flex: 1 }} />
            <div className={`${styles.skel} ${styles.skelPtsCell}`} />
          </div>
        ))}
      </div>

      <span className={shell.srOnly}>Cargando la tabla…</span>
    </main>
  );
}
