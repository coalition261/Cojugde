import { Backdrop } from "@/components/backdrop";
import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/home/hero";
import { ChecksShowcase, FinalCta, Footer, HowItWorks, HumanInTheLoop, Integrations, Metrics } from "@/components/home/sections";

export default function HomePage() {
  return (
    <>
      <Backdrop />
      <SiteNav />
      <main id="main">
        <Hero />
        <Metrics />
        <HowItWorks />
        <ChecksShowcase />
        <HumanInTheLoop />
        <Integrations />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
