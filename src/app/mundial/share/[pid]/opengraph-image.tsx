import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getShareData } from "@/lib/prode/data";
import { teamEsName } from "@/lib/prode/countries";

/**
 * Placa compartible dinámica por jugador (1200×630). Se renderiza cuando alguien
 * pega el link /mundial/share/[pid] en WhatsApp/IG: muestra a quién le apostó
 * como campeón. Estética Monaco (oro/celeste sobre graphite, fuente Proxima).
 * Runtime Node (default) para leer las fuentes del disco y usar el service-role.
 */
export const alt = "Prode Mundial 2026 — Monaco";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// La placa sólo cambia cuando el jugador cambia su campeón → cacheamos por pid 1h
// (corta la amplificación de queries service-role por unfurls/crawlers/reintentos).
export const revalidate = 3600;

// Tokens de marca (espejo de Shell.module.css).
const GOLD = "#e9c46a";
const GOLD_DEEP = "#d4af37";
const CELESTE = "#79c0f2";
const GRAPHITE = "#16181c";

export default async function Image({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;

  const share = await getShareData(pid).catch(() => null);
  const [black, bold] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/proxima-nova-alt-black.otf")),
    readFile(join(process.cwd(), "public/fonts/proxima-nova-bold.otf")),
  ]);

  const name = (share?.display_name || "Un crack").trim();
  const champion = share?.champion ? teamEsName(share.champion).toUpperCase() : null;
  const flag = share?.champion?.flag_url ?? null;
  // Satori (next/og) NO rasteriza SVG remoto vía <img src>; sólo PNG/JPG. La
  // mayoría de los escudos de football-data son .svg → si no es raster, omitimos
  // la bandera (la placa luce bien sólo con el texto) en vez de romper la imagen.
  const flagOk = !!flag && /\.(png|jpe?g)(\?|$)/i.test(flag);
  const points = share?.total_points ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          color: "#ffffff",
          fontFamily: "Proxima",
          backgroundColor: GRAPHITE,
          backgroundImage: `radial-gradient(1100px 620px at 50% -12%, rgba(233,196,106,0.22), rgba(22,24,28,0) 60%)`,
        }}
      >
        {/* franja superior celeste→oro→celeste */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            display: "flex",
            backgroundImage: `linear-gradient(90deg, ${CELESTE}, ${GOLD}, ${CELESTE})`,
          }}
        />

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: 2 }}>MONACO</span>
            <span
              style={{
                fontSize: 19,
                fontWeight: 800,
                letterSpacing: 3,
                color: GOLD,
                padding: "8px 16px",
                borderRadius: 999,
                border: `1px solid rgba(233,196,106,0.4)`,
                backgroundColor: "rgba(233,196,106,0.14)",
              }}
            >
              PRODE MUNDIAL 2026
            </span>
          </div>
          <span style={{ fontSize: 60 }}>🏆</span>
        </div>

        {/* bloque central */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 4, color: GOLD }}>
            LA QUINIELA DEL CAMPEÓN
          </span>

          {champion ? (
            <>
              <span style={{ fontSize: 46, fontWeight: 700, color: "#e8e8e8" }}>
                {name} le apostó a
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 4 }}>
                {flagOk && flag ? (
                  <img
                    src={flag}
                    alt=""
                    width={116}
                    height={116}
                    style={{ borderRadius: 18, objectFit: "cover", border: "2px solid rgba(255,255,255,0.18)" }}
                  />
                ) : null}
                <span
                  style={{
                    fontSize: 96,
                    fontWeight: 900,
                    lineHeight: 1,
                    color: GOLD,
                    letterSpacing: -1,
                  }}
                >
                  {champion}
                </span>
              </div>
              <span style={{ fontSize: 50, fontWeight: 800, marginTop: 8 }}>campeón del Mundial 🏆</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 46, fontWeight: 700, color: "#e8e8e8" }}>
                {name} está jugando el
              </span>
              <span style={{ fontSize: 104, fontWeight: 900, lineHeight: 1, color: GOLD, letterSpacing: -1 }}>
                MUNDIAL 2026 🏆
              </span>
            </>
          )}
        </div>

        {/* footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: CELESTE,
              display: "flex",
              alignItems: "center",
            }}
          >
            ¿Le ganás? Jugá gratis y ganá cortes 💈
          </span>
          <span
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "#0f1012",
              padding: "10px 20px",
              borderRadius: 999,
              backgroundImage: `linear-gradient(135deg, #f6dd92, ${GOLD} 50%, ${GOLD_DEEP})`,
            }}
          >
            {points > 0 ? `${points} pts` : "monaco.app"}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Proxima", data: black, weight: 900, style: "normal" },
        { name: "Proxima", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
