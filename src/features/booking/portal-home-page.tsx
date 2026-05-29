import { ScrollReveal } from '../../components/layout/scroll-reveal';
import { DoctorsSection } from './sections/doctors-section';
import { FaqSection } from './sections/faq-section';
import { FeaturesSection } from './sections/features-section';
import { HeroSection } from './sections/hero-section';
import { HowItWorksSection } from './sections/how-it-works-section';
import { ServicesSection } from './sections/services-section';

/** Set true to show meet-the-team (`DoctorsSection`) on portal home again. */
const portalHomeShowMeetTheTeamSection = false;

/** Set true to show the services section on portal home again. */
const portalHomeShowServicesSection = false;

export function PortalHomePage() {
  return (
    <div className="pb-0">
      <ScrollReveal yOffset={24} className="w-full">
        <HeroSection />
      </ScrollReveal>
      <div className="w-full space-y-0 py-0">
        <ScrollReveal delayMs={60}>
          <HowItWorksSection />
        </ScrollReveal>
        {portalHomeShowServicesSection ? (
          <ScrollReveal delayMs={100}>
            <ServicesSection />
          </ScrollReveal>
        ) : null}
        <ScrollReveal delayMs={140}>
          <FeaturesSection />
        </ScrollReveal>
        {portalHomeShowMeetTheTeamSection ? (
          <ScrollReveal delayMs={180}>
            <DoctorsSection />
          </ScrollReveal>
        ) : null}
        <ScrollReveal delayMs={260}>
          <FaqSection />
        </ScrollReveal>
      </div>
    </div>
  );
}
