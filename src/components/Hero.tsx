"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import styles from "./Hero.module.css";
import Image from "next/image";

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={containerRef} className={styles.heroSection}>
      {/* Subtle noise texture */}
      <div className={styles.noiseOverlay}></div>

      <motion.div
        className={styles.container}
        style={{ y: contentY, opacity: contentOpacity }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <Image
          src="/Logotipo con Bajada (3).png"
          alt="Monaco Barber Studio"
          width={900}
          height={450}
          className={styles.heroLogo}
          priority
        />


      </motion.div>

      {/* Scroll indicator — "Deslizar" */}
      <motion.div
        className={styles.scrollIndicator}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.8, ease: "easeOut" }}
      >
        <span className={styles.scrollText}>Deslizar</span>
        <div className={styles.scrollLine}>
          <div className={styles.scrollDot}></div>
        </div>
      </motion.div>
    </section>
  );
}
