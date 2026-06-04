import shell from "../Shell.module.css";
import styles from "./Loading.module.css";

/** Skeleton de la pantalla Jugar mientras se resuelven torneo, preguntas y sesión. */
export default function Loading() {
  return (
    <main className={shell.content}>
      <div className={styles.head}>
        <span className={`${styles.sk} ${styles.skTitle}`} />
        <span className={`${styles.sk} ${styles.skSub}`} />
      </div>

      <div className={`${shell.card} ${shell.cardTopline} ${styles.card}`} aria-hidden="true">
        <span className={`${styles.sk} ${styles.skLabel}`} />
        <span className={`${styles.sk} ${styles.skField}`} />
        <span className={`${styles.sk} ${styles.skLabel}`} />
        <span className={`${styles.sk} ${styles.skField}`} />
        <span className={`${styles.sk} ${styles.skBtn}`} />
      </div>

      <span className={shell.srOnly} role="status">Cargando el Prode…</span>
    </main>
  );
}
