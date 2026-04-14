"use client";

import { useEffect, useRef } from "react";
import styles from "./Services.module.css";
import { Scissors, Ruler } from "lucide-react";

export default function Services() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
          }
        });
      },
      { threshold: 0.2 }
    );

    const reveals = document.querySelectorAll(`.${styles.column}`);
    reveals.forEach((el) => observer.observe(el));
    const title = document.querySelector(`.${styles.sectionTitle}`);
    if (title) observer.observe(title);

    return () => {
      reveals.forEach((el) => observer.unobserve(el));
      if (title) observer.unobserve(title);
    };
  }, []);

  return (
    <section className={styles.servicesSection} id="services" ref={sectionRef}>
      <h2 className={`${styles.sectionTitle} reveal`}>NUESTROS DIFERENCIALES</h2>

      <div className={styles.gridContainer}>
        {/* Left Column - Cortes Modernos */}
        <div className={`${styles.column} ${styles.columnLeft}`}>
          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <h3>Cortes Modernos</h3>
              <span className={styles.icon}><Scissors /></span>
            </div>
            <p className={styles.cardText}>
              Precisión de nivel arquitectónico. Desde Fade Masters
              hasta especialistas a tijera pura. Diseñamos la estructura
              que mejor se adapta a tu perfil craneal.
            </p>
            <ul className={styles.serviceList}>
              <li>Taper Fade / Low Fade</li>
              <li>Scissor Cuts</li>
              <li>Textured Crops</li>
            </ul>
          </div>
        </div>

        {/* Right Column - Asesoría de Imagen (Asymmetric Offset) */}
        <div className={`${styles.column} ${styles.columnRight}`}>
          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <h3>Asesoría de Imagen</h3>
              <span className={styles.icon}><Ruler /></span>
            </div>
            <p className={styles.cardText}>
              No somos solo barberos, somos arquitectos de tu estilo.
              Recomendamos los cortes y el cuidado de la barba en función a
              la forma de tu rostro y tu estilo de vida.
            </p>
            <ul className={styles.serviceList}>
              <li>Visagismo Facial</li>
              <li>Perfilado de Barba VIP</li>
              <li>Cuidado Capilar Premium</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
