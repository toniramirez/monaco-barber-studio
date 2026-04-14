import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const proximaNova = localFont({
  src: [
    {
      path: '../../public/fonts/proxima-nova-alt-reg.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/proxima-nova-bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../public/fonts/proxima-nova-alt-black.otf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: "--font-proxima",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Monaco Barber Studio | The World's First Intelligent Barbershop",
  description: "El Referente de Córdoba (Desde 2019). Disfruta de la primera barbería inteligente del mundo con tecnología Face ID y cortes modernos.",
  keywords: ["Monaco Barber Studio", "Barbería Córdoba", "Cortes Modernos", "Asesoría de Imagen"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={proximaNova.variable}>
      <body style={{ fontFamily: "var(--font-proxima), sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
