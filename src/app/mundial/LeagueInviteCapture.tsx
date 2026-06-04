"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, PartyPopper, X } from "lucide-react";
import { rememberLeagueInvite } from "./actions";
import styles from "./LeagueInvite.module.css";

/**
 * Captura la invitación de liga del link compartido (?liga=CODE) en CUALQUIER
 * pantalla del Prode (vive en el layout). Si el jugador ya está registrado lo
 * une en el acto; si no, guarda el código (cookie) para auto-unirlo al
 * registrarse. Muestra un banner liviano de confirmación. Sin toast lib: el
 * banner es propio y descartable.
 */
export default function LeagueInviteCapture() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("liga");
  const handled = useRef<string | null>(null);
  const [banner, setBanner] = useState<{ joined: boolean; name: string } | null>(null);

  useEffect(() => {
    if (!code || handled.current === code) return;
    handled.current = code;
    // Dedup entre navegaciones (share → jugar re-monta este componente con el
    // mismo ?liga=): si ya lo capturamos en esta sesión, no re-disparamos ni
    // re-mostramos el banner. La cookie ya quedó seteada en la primera captura.
    const skey = `prode_liga_seen_${code}`;
    try {
      if (sessionStorage.getItem(skey) === "1") return;
    } catch {
      /* sessionStorage no disponible: seguimos igual */
    }
    rememberLeagueInvite(code)
      .then((r) => {
        try { sessionStorage.setItem(skey, "1"); } catch { /* noop */ }
        if (!r.ok || !r.data.name) return;
        // setState dentro del .then() (async), no en el cuerpo del effect: no rompe reglas de hooks.
        setBanner({ joined: r.data.joined, name: r.data.name });
        if (r.data.joined) router.refresh(); // refresca la tabla con la nueva liga
      })
      .catch(() => {});
  }, [code, router]);

  if (!banner) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles.icon} aria-hidden="true">
        {banner.joined ? <PartyPopper size={18} /> : <Users size={18} />}
      </span>
      <span className={styles.text}>
        {banner.joined ? (
          <>
            ¡Te uniste a la liga <strong>{banner.name}</strong>! 🎉
          </>
        ) : (
          <>
            Te sumás a la liga <strong>{banner.name}</strong> al registrarte 👇
          </>
        )}
      </span>
      <button type="button" className={styles.close} aria-label="Cerrar" onClick={() => setBanner(null)}>
        <X size={15} />
      </button>
    </div>
  );
}
