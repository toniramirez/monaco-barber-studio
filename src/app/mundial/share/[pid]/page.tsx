import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Trophy, Sparkles } from "lucide-react";
import shell from "../../Shell.module.css";
import styles from "./Share.module.css";
import { getShareData } from "@/lib/prode/data";
import { teamEsName } from "@/lib/prode/countries";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ pid: string }>;
  searchParams: Promise<{ liga?: string }>;
};

/**
 * Metadata del link compartido: el título/descr alimentan el preview de
 * WhatsApp/IG; la imagen la provee opengraph-image.tsx (misma ruta).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pid } = await params;
  let title = "Prode Mundial 2026 — Monaco";
  let description = "Armá tu prode del Mundial 2026, sumá fichas y ganá cortes en Monaco.";
  try {
    const s = await getShareData(pid);
    if (s) {
      const champ = s.champion ? teamEsName(s.champion) : null;
      title = champ
        ? `${s.display_name} le apostó a ${champ} campeón. ¿le ganás?`
        : `${s.display_name} está jugando el Prode Mundial. ¿le ganás?`;
      description = "Sumate gratis al Prode Mundial de Monaco, armá tu prode y ganá cortes.";
    }
  } catch {
    /* fallback al título genérico */
  }
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Pantalla de aterrizaje del link compartido (la placa del jugador). Invita a
 * sumarse y, si el link traía ?liga=, el LeagueInviteCapture del layout ya
 * dejó al amigo listo para entrar a esa liga. El CTA arrastra el ?liga.
 */
export default async function SharePage({ params, searchParams }: Props) {
  const { pid } = await params;
  const { liga } = await searchParams;
  const s = await getShareData(pid).catch(() => null);

  const name = s?.display_name || "Un crack";
  const champ = s?.champion ? teamEsName(s.champion) : null;
  const flag = s?.champion?.flag_url ?? null;
  const jugarHref = liga ? `/mundial/jugar?liga=${encodeURIComponent(liga)}` : "/mundial/jugar";

  return (
    <main className={shell.content}>
      <section className={`${shell.card} ${shell.cardTopline} ${styles.card}`}>
        <span className={shell.eyebrow}>
          <Sparkles size={13} aria-hidden="true" /> Prode Mundial 2026 · Monaco
        </span>

        <h1 className={`${shell.shineTitle} ${styles.title}`}>{name} te desafía</h1>

        {champ ? (
          <div className={styles.pick}>
            {flag ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.pickFlag} src={flag} alt="" width={56} height={56} loading="lazy" />
            ) : (
              <Trophy size={40} className={styles.pickIcon} aria-hidden="true" />
            )}
            <p className={styles.pickText}>
              Le apostó a <strong className={styles.hl}>{champ}</strong> campeón del Mundial
            </p>
          </div>
        ) : (
          <p className={styles.lead}>
            Está jugando <strong className={styles.hl}>El Prode de Monaco</strong>. ¿Le ganás?
          </p>
        )}

        <p className={styles.lead}>
          Armá tu prode gratis, sumá fichas y ganá <strong className={styles.hl}>cortes</strong> en
          Monaco. ¿Te animás a ganarle?
        </p>

        <Link href={jugarHref} className={`${shell.btnPrimary} ${styles.cta}`}>
          Jugar gratis <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <p className={styles.note}>Gratis · te verificamos por WhatsApp en 20 segundos</p>

        <Link href="/mundial" className={shell.btnGhost}>
          Ver de qué se trata
        </Link>
      </section>
    </main>
  );
}
