import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { PrimaryNav } from "@/components/primary-nav";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <SiteHeader showDesktopNav={false} />
      <main className="min-h-screen bg-white text-neutral-900 antialiased">
        <Hero />
        <div className="hidden md:block">
          <PrimaryNav />
        </div>
        <Footer />
      </main>
    </>
  );
}
