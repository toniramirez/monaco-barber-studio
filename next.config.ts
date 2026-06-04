import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
      {
        // Banderas/escudos de las selecciones (football-data.org) usados en el Prode.
        protocol: 'https',
        hostname: 'crests.football-data.org',
      },
    ],
  },
};

export default nextConfig;
