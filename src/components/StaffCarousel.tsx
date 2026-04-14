"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StaffCarousel.module.css";

const STAFF_DATA = [
  {
    id: 1,
    name: "Tony",
    specialty: "Fade Master",
    image: "https://i.pravatar.cc/400?img=11", 
    instagram: "@tony.monaco"
  },
  {
    id: 2,
    name: "Sol",
    specialty: "Scissor Expert",
    image: "https://i.pravatar.cc/400?img=5",
    instagram: "@sol.monaco"
  },
  {
    id: 3,
    name: "Marcos",
    specialty: "Visagismo Facial",
    image: "https://i.pravatar.cc/400?img=33",
    instagram: "@marcos.monaco"
  },
  {
    id: 4,
    name: "Leo",
    specialty: "Beard Specialist",
    image: "https://i.pravatar.cc/400?img=60",
    instagram: "@leo.monaco"
  }
];

export default function StaffCarousel() {
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const scrollContainer = useRef<HTMLDivElement>(null);

  const handleInteraction = (id: number) => {
    setActiveCard(activeCard === id ? null : id);
  };

  return (
    <section className={styles.staffSection}>
      <h2 className={styles.sectionTitle}>Los Arquitectos del Estilo</h2>
      
      <div className={styles.carouselWrapper}>
        <div className={styles.carousel} ref={scrollContainer}>
          {STAFF_DATA.map((staff) => (
            <div 
              key={staff.id} 
              className={`${styles.staffCard} ${activeCard === staff.id ? styles.cardActive : ""}`}
              onClick={() => handleInteraction(staff.id)}
              onMouseEnter={() => setActiveCard(staff.id)}
              onMouseLeave={() => setActiveCard(null)}
            >
              <div className={styles.imageWrapper}>
                {/* Standard img used for external avatars without configuring next.config.mjs */}
                <img 
                  src={staff.image} 
                  alt={staff.name}
                  loading="lazy"
                  className={styles.staffImage}
                />
              </div>

              {/* Data Card hovering with Glassmorphism */}
              <div className={`${styles.dataCard} glass`}>
                <h3 className={styles.staffName}>{staff.name}</h3>
                <p className={styles.staffSpecialty}>{staff.specialty}</p>
                <a 
                  href={`https://instagram.com/${staff.instagram.replace('@','')}`} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.instaBtn} haptic-btn`}
                  onClick={(e) => e.stopPropagation()}
                >
                  Portfolio IG
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
