"use client";

import { useEffect, useState } from "react";
import styles from "./Locations.module.css";
import { MapPin, Clock, Info, ChevronRight } from "lucide-react";

const LOCATIONS_DATA = [
  {
    id: 1,
    name: "Paraná",
    address: "Paraná 419",
    hours: "Lun-Sáb: 10:00 – 21:00",
    info: "Orden de Llegada",
    openTime: 10,
    closeTime: 21,
    openDays: [1, 2, 3, 4, 5, 6],
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3404.681565397109!2d-64.1819362246332!3d-31.42289839656583!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9432a3763ce25b21%3A0xac805685105f9761!2zTU9OQUNPIOKAkyDKmeG0gMqAypnhtIfKgCDqnLHhtJvhtJzhtIXJquG0jw!5e0!3m2!1ses-419!2sar!4v1776208986301!5m2!1ses-419!2sar",
    mapsUrl: "https://maps.google.com/?q=Parana+419+Cordoba+Argentina",
  },
  {
    id: 2,
    name: "Caseros",
    address: "Caseros 344",
    hours: "Lun-Vie: 10:00 – 19:30",
    info: "Orden de Llegada",
    openTime: 10,
    closeTime: 19.5,
    openDays: [1, 2, 3, 4, 5],
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3404.9016676530664!2d-64.1896629!3d-31.416835199999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9432a291c768fd63%3A0x20ac97fede86e842!2zTU9OQUNPIDIg4oCTIMqZ4bSAyoDKmeG0h8qAIOqcseG0m-G0nOG0hcmq4bSP!5e0!3m2!1ses-419!2sar!4v1776208904390!5m2!1ses-419!2sar",
    mapsUrl: "https://maps.google.com/?q=Caseros+344+Cordoba+Argentina",
  },
  {
    id: 3,
    name: "Rondeau",
    address: "Rondeau 30",
    hours: "Lun-Sáb: 10:00 – 21:00",
    info: "Orden de Llegada",
    openTime: 10,
    closeTime: 21,
    openDays: [1, 2, 3, 4, 5, 6],
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3404.707141661252!2d-64.18879982463318!3d-31.422193896531663!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9432a37196643299%3A0x4df9d0f77528bb15!2zTU9OQUNPIDMg4oCTIMqZ4bSAyoDKmeG0h8qAIOqcseG0m-G0nOG0hcmq4bSP!5e0!3m2!1ses-419!2sar!4v1776208933893!5m2!1ses-419!2sar",
    mapsUrl: "https://maps.google.com/?q=Rondeau+30+Cordoba+Argentina",
  },
];

export default function Locations() {
  const [activeTab, setActiveTab] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isLocationOpen = (loc: (typeof LOCATIONS_DATA)[0]) => {
    const day = currentDate.getDay();
    const hour = currentDate.getHours() + currentDate.getMinutes() / 60;
    if (!loc.openDays.includes(day)) return false;
    return hour >= loc.openTime && hour < loc.closeTime;
  };

  const activeLoc = LOCATIONS_DATA[activeTab];
  const isOpen = isLocationOpen(activeLoc);

  return (
    <section className={styles.locationsSection} id="sucursales">
      <h2 className={styles.sectionTitle}>Nuestras Sucursales</h2>
      <p className={styles.sectionSubtitle}>
        Visitanos en cualquiera de nuestras 3 sedes en Córdoba
      </p>

      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        {LOCATIONS_DATA.map((loc, idx) => (
          <button
            key={loc.id}
            className={`${styles.tab} ${activeTab === idx ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(idx)}
          >
            <span className={styles.tabDot}>
              <span
                className={`${styles.tabDotInner} ${isLocationOpen(loc) ? styles.dotOpen : styles.dotClosed}`}
              />
            </span>
            Monaco {loc.name}
          </button>
        ))}
      </div>

      {/* Content Card */}
      <div className={styles.contentWrapper}>
        {/* Map Container */}
        <div className={styles.mapContainer}>
          <iframe
            key={activeLoc.id}
            src={activeLoc.mapEmbed}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Mapa de Monaco ${activeLoc.name}`}
          />
        </div>

        {/* Info Glass Panel */}
        <div className={styles.infoPanel}>
          <div className={styles.infoPanelInner}>
            {/* Status */}
            <div className={styles.statusRow}>
              <div
                className={`${styles.statusBadge} ${isOpen ? styles.open : styles.closed}`}
              >
                <span className={styles.statusDot} />
                {isOpen ? "Abierto ahora" : "Cerrado"}
              </div>
            </div>

            {/* Title */}
            <h3 className={styles.locName}>Monaco {activeLoc.name}</h3>

            {/* Details */}
            <div className={styles.detailsList}>
              <div className={styles.detailRow}>
                <MapPin size={18} className={styles.detailIcon} />
                <span>{activeLoc.address}</span>
              </div>
              <div className={styles.detailRow}>
                <Clock size={18} className={styles.detailIcon} />
                <span>{activeLoc.hours}</span>
              </div>
              <div className={styles.detailRow}>
                <Info size={18} className={styles.detailIcon} />
                <span>{activeLoc.info}</span>
              </div>
            </div>

            {/* CTA */}
            <a
              href={activeLoc.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.ctaBtn} haptic-btn`}
            >
              Cómo llegar
              <ChevronRight size={18} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
