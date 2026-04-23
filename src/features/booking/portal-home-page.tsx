import { DoctorsSection } from './sections/doctors-section';
import { FeaturesSection } from './sections/features-section';
import { HeroSection } from './sections/hero-section';
import { ServicesSection } from './sections/services-section';
import { ScrollReveal } from '../../components/layout/scroll-reveal';

export function PortalHomePage() {
  return (
    <div className="pb-0">
      <ScrollReveal yOffset={24}>
        <HeroSection />
      </ScrollReveal>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 lg:px-8">
        <ScrollReveal delayMs={60}>
          <FeaturesSection />
        </ScrollReveal>
        <ScrollReveal delayMs={120}>
          <ServicesSection />
        </ScrollReveal>
        <ScrollReveal delayMs={170}>
          <DoctorsSection />
        </ScrollReveal>
      </div>
    </div>
  );
}
