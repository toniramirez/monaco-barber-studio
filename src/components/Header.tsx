import styles from "./Header.module.css";
import Image from "next/image";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logoWrapper}>
          <Image
            src="/Abreviación (1).png"
            alt="Monaco Barber Studio Abbreviation"
            width={40}
            height={40}
            priority
            className={styles.abbrevLogo}
          />
          <span className={styles.brandText}>MONACO</span>
        </div>
        <nav className={styles.nav}>
          <a href="#services" className={styles.navLink}>Servicios</a>
          <a href="#locations" className={styles.navLink}>Sucursales</a>
          <a href="https://wa.me/543517691830" className={styles.bookBtn}>Reservar</a>
        </nav>
      </div>
    </header>
  );
}
