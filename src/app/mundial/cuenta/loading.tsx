import shell from "../Shell.module.css";
import styles from "./Cuenta.module.css";

/** Skeleton de "Mi cuenta": perfil + dos bloques (Quiniela / Liga). */
export default function Loading() {
  return (
    <main className={shell.content} aria-busy="true" aria-label="Cargando tu cuenta">
      <span className={shell.srOnly}>Cargando tu cuenta…</span>

      <div className={`${shell.card} ${shell.cardTopline} ${styles.profileCard}`}>
        <div className={`${styles.skel} ${styles.skelAvatar}`} />
        <div className={styles.profileInfo}>
          <div className={`${styles.skel} ${styles.skelLineLg}`} />
          <div className={`${styles.skel} ${styles.skelLineSm}`} />
        </div>
      </div>

      <div className={`${shell.card} ${styles.block}`}>
        <div className={`${styles.skel} ${styles.skelTitle}`} />
        <div className={`${styles.skel} ${styles.skelRow}`} />
        <div className={`${styles.skel} ${styles.skelRow}`} />
        <div className={`${styles.skel} ${styles.skelRow}`} />
      </div>

      <div className={`${shell.card} ${styles.block}`}>
        <div className={`${styles.skel} ${styles.skelTitle}`} />
        <div className={`${styles.skel} ${styles.skelRow}`} />
        <div className={`${styles.skel} ${styles.skelBtn}`} />
      </div>
    </main>
  );
}
