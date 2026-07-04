import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import About from "@/components/About";
import Programs from "@/components/Programs";
import Approach from "@/components/Approach";
import WhyUs from "@/components/WhyUs";
import Visit from "@/components/Visit";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Stats />
        <About />
        <Programs />
        <Approach />
        <WhyUs />
        <Visit />
      </main>
      <Footer />
    </>
  );
}
