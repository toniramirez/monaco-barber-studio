import Hero from "@/components/Hero";
import Scanner from "@/components/Scanner";
import InstagramCarousel from "@/components/InstagramCarousel";
import Locations from "@/components/Locations";
import Footer from "@/components/Footer";
import ScrollReveal from "@/components/ScrollReveal";

export default function Home() {
  return (
    <main>
      <Hero />
      <ScrollReveal>
        <Scanner />
      </ScrollReveal>
      <ScrollReveal>
        <InstagramCarousel />
      </ScrollReveal>

      <ScrollReveal>
        <Locations />
      </ScrollReveal>
      <Footer />
    </main>
  );
}
