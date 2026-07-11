import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import PainPoints from "@/components/PainPoints";
import Stages from "@/components/Stages";
import Programs from "@/components/Programs";
import Gallery from "@/components/Gallery";
import About from "@/components/About";
import Proprietors from "@/components/Proprietors";
import WhyUs from "@/components/WhyUs";
import Partners from "@/components/Partners";
import Visit from "@/components/Visit";
import CtaBand from "@/components/CtaBand";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Stats />
        <PainPoints />
        <Stages />
        <Programs />
        <Gallery />
        <About />
        <Proprietors />
        <WhyUs />
        <Partners />
        <Visit />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}
