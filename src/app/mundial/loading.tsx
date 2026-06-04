import shell from "./Shell.module.css";
import styles from "./Inicio.module.css";

/**
 * Skeleton de carga del Inicio: bloques pulsantes que reservan el espacio del
 * hero, el partido del día y las secciones mientras se traen los datos del server.
 */
export default function Loading() {
  return (
    <main className={shell.content}>
      <span className={shell.srOnly} role="status">
        Cargando el Prode Mundial…
      </span>
      <div className={styles.skeleton} aria-hidden="true">
        <div className={`${styles.skelBlock} ${styles.skelHero}`} />
        <div className={`${styles.skelBlock} ${styles.skelLine}`} />
        <div className={`${styles.skelBlock} ${styles.skelLineSm}`} />
        <div className={`${styles.skelBlock} ${styles.skelLineSm}`} />
        <div className={`${styles.skelBlock} ${styles.skelLineSm}`} />
      </div>
    </main>
  );
}
