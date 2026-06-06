/**
 * Ícono de "ruleta" (rueda de la fortuna) — SVG, no emoji ni el CD de lucide.
 * Hereda el color vía currentColor.
 */
export function RouletteIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M12 3v3.4M12 17.6V21M3 12h3.4M17.6 12H21M5.64 5.64l2.4 2.4M15.96 15.96l2.4 2.4M18.36 5.64l-2.4 2.4M8.04 15.96l-2.4 2.4" />
    </svg>
  );
}
