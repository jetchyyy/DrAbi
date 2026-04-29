import { ScrollReveal } from '../../components/layout/scroll-reveal';
import { DoctorsSection } from './sections/doctors-section';
import { FaqSection } from './sections/faq-section';
import { FeaturesSection } from './sections/features-section';
import { HeroSection } from './sections/hero-section';
import { HowItWorksSection } from './sections/how-it-works-section';
import { ServicesSection } from './sections/services-section';

export function PortalHomePage() {
  return (
    <div className="pb-0">
      <ScrollReveal yOffset={24}>
        <HeroSection />
      </ScrollReveal>
      <div className="w-full space-y-0 py-0">
        <ScrollReveal delayMs={60}>
          <HowItWorksSection />
        </ScrollReveal>
        <ScrollReveal delayMs={100}>
          <ServicesSection />
        </ScrollReveal>
        <ScrollReveal delayMs={140}>
          <FeaturesSection />
        </ScrollReveal>
        <ScrollReveal delayMs={180}>
          <DoctorsSection />
        </ScrollReveal>
        <ScrollReveal delayMs={260}>
          <FaqSection />
        </ScrollReveal>
      </div>
    </div>
  );
}
