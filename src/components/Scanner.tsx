"use client";

import { useEffect, useRef } from "react";
import styles from "./Scanner.module.css";

export default function Scanner() {
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

    const reveals = document.querySelectorAll(".reveal-scanner");
    reveals.forEach((el) => observer.observe(el));

    return () => reveals.forEach((el) => observer.unobserve(el));
  }, []);

  return (
    <section className={styles.scannerSection} ref={sectionRef}>
      <div className={styles.container}>
        <div className={`${styles.textContent} reveal-scanner`}>
          <h2 className={styles.title}>
            The World&apos;s First <br />
            <span className={styles.accent}>Intelligent Barbershop</span>
          </h2>
          <p className={styles.description}>
            Reconocimiento facial y registro biométrico visionario. 
            Tu experiencia y estilo quedan guardados en nuestro sistema inteligente.
          </p>
        </div>

        <div className={`${styles.scannerWrapper} reveal-scanner`}>
          <div className={styles.scannerFrame}>
            <div className={styles.cornerTopLeft}></div>
            <div className={styles.cornerTopRight}></div>
            <div className={styles.cornerBottomLeft}></div>
            <div className={styles.cornerBottomRight}></div>
            <div className={styles.scanLine}></div>
            
            <div className={styles.facePlaceholder}>
              {/* Abstract face representation */}
              <div className={styles.grid}></div>
            </div>
          </div>
          <div className={styles.statusBadge}>
            <div className={styles.pulseDot}></div>
            <span>Face ID Active</span>
          </div>
        </div>
      </div>
    </section>
  );
}
