import { useSyncExternalStore } from "react";

/**
 * Reloj compartido SSR-safe para todo el Prode (countdowns, "se te pasó", etc.).
 *
 * CLAVE (no romper): `getSnapshot` devuelve un valor CACHEADO (`cachedNow`) que
 * SÓLO cambia cuando el interval notifica. NUNCA devolver `Date.now()` directo:
 * useSyncExternalStore lee el snapshot varias veces por commit y, si cambia en
 * cada lectura, React entra en loop infinito de re-render ("Maximum update depth
 * exceeded"). En el server el snapshot es null → sin mismatch de hidratación.
 *
 * Un solo interval para todos los relojes; se prende con el primer subscriber y
 * se apaga cuando no queda ninguno.
 */
let cachedNow = 0;
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
  cachedNow = Date.now();
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!running) {
    running = true;
    cachedNow = Date.now();
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      running = false;
    }
  };
}

// `running` arranca en false → null en SSR y en el primer render del cliente
// (igual que el server, sin mismatch). Tras subscribe queda el valor cacheado,
// estable entre ticks.
const getSnapshot = (): number | null => (running ? cachedNow : null);
const getServerSnapshot = (): number | null => null;

/** Milisegundos actuales (null en SSR / primer render del cliente). */
export function useNowMs(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Segundos actuales (null en SSR / primer render del cliente). */
export function useNowSeconds(): number | null {
  const ms = useNowMs();
  return ms === null ? null : Math.floor(ms / 1000);
}
