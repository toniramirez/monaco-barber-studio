"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import styles from "./InstagramCarousel.module.css";

const IG_REELS = [
  {
    video: "/videos/reel-1.mp4",
    url: "https://www.instagram.com/p/DBMNMRMx8S9/",
  },
  {
    video: "/videos/reel-2.mp4",
    url: "https://www.instagram.com/p/DWmDtpyEw-N/",
  },
  {
    video: "/videos/reel-3.mp4",
    url: "https://www.instagram.com/p/DR41UsGDsz_/",
  },
];

export default function InstagramCarousel() {
  const [active, setActive] = useState(0);
  const [sectionVisible, setSectionVisible] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  /* ── Section-level observer: detect when carousel enters viewport ── */
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setSectionVisible(entry.isIntersecting);
      },
      { threshold: 0.2 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  /* ── Slide-level observer: detect which slide is in view ── */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = slideRefs.current.indexOf(
              entry.target as HTMLDivElement
            );
            if (idx !== -1) {
              setActive(idx);
            }
          }
        });
      },
      { root: track, threshold: 0.6 }
    );

    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /* ── Autoplay: play the active video, pause all others ── */
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;

      if (i === active && sectionVisible) {
        // Play the active video
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay was prevented — browser requirement
          });
        }
      } else {
        // Pause all inactive videos
        video.pause();
      }
    });
  }, [active, sectionVisible]);

  /* ── Navigation ── */
  const goToSlide = useCallback((index: number) => {
    const slide = slideRefs.current[index];
    const track = trackRef.current;
    if (!slide || !track) return;

    const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
    const trackCenter = track.offsetWidth / 2;
    track.scrollTo({
      left: slideCenter - trackCenter,
      behavior: "smooth",
    });
  }, []);

  const prev = () => goToSlide(Math.max(0, active - 1));
  const next = () => goToSlide(Math.min(IG_REELS.length - 1, active + 1));

  return (
    <section className={styles.section} id="instagram-carousel" ref={sectionRef}>
      {/* Section Title */}
      <div className={styles.sectionHeader}>
        <h3>Seguinos en nuestro Instagram</h3>
        <a
          href="https://instagram.com/monaco.barberia"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.handle}
        >
          @monaco.barberia
        </a>
      </div>

      {/* Carousel */}
      <div className={styles.carouselWrap}>
        {/* ◀ Prev */}
        <button
          className={`${styles.arrow} ${styles.arrowPrev}`}
          onClick={prev}
          disabled={active === 0}
          aria-label="Anterior"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Track */}
        <div className={styles.track} ref={trackRef}>
          {IG_REELS.map((reel, i) => (
            <div
              key={i}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              className={`${styles.slide} ${active === i ? styles.slideActive : ""}`}
            >
              {/* ─── Native Video ─── */}
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                className={styles.video}
                src={reel.video}
                muted
                loop
                playsInline
                preload="metadata"
                poster=""
              />

              {/* ─── Top Overlay: Monaco Branding ─── */}
              <div className={styles.overlayTop}>
                <div className={styles.profileRow}>
                  <div className={styles.avatar}>
                    <Image
                      src="/Abreviación (1).png"
                      alt="Monaco"
                      width={24}
                      height={24}
                      style={{ objectFit: "contain" }}
                    />
                  </div>
                  <span className={styles.username}>monaco.barberia</span>
                  {/* Verified badge */}
                  <svg className={styles.verified} viewBox="0 0 40 40" width="15" height="15" aria-label="Verificado">
                    <defs>
                      <linearGradient id={`vg-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4FC3F7" />
                        <stop offset="100%" stopColor="#0095F6" />
                      </linearGradient>
                    </defs>
                    <circle cx="20" cy="20" r="20" fill={`url(#vg-${i})`} />
                    <path d="M17 28L9 20l3-3 5 5L28 11l3 3z" fill="#fff" />
                  </svg>
                </div>
              </div>

              {/* ─── Bottom Overlay: Visit Reel Button ─── */}
              <div className={styles.overlayBottom}>
                <a
                  href={reel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.visitBtn}
                >
                  {/* Instagram icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="17.5" cy="6.5" r="1.3" fill="currentColor" />
                  </svg>
                  Ver en Instagram
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* ▶ Next */}
        <button
          className={`${styles.arrow} ${styles.arrowNext}`}
          onClick={next}
          disabled={active === IG_REELS.length - 1}
          aria-label="Siguiente"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Dot indicators */}
      <div className={styles.dots}>
        {IG_REELS.map((_, i) => (
          <button
            key={i}
            className={`${styles.dot} ${active === i ? styles.dotActive : ""}`}
            onClick={() => goToSlide(i)}
            aria-label={`Ir al slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
