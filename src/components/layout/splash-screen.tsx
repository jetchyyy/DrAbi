interface SplashScreenProps {
  clinicName: string;
}

export function SplashScreen({ clinicName }: SplashScreenProps) {
  return (
    <section className="splash-screen" aria-label="Loading screen">
      <div className="splash-screen__glow splash-screen__glow--one" aria-hidden="true" />
      <div className="splash-screen__glow splash-screen__glow--two" aria-hidden="true" />

      <div className="splash-screen__card">
        <p className="splash-screen__eyebrow">Odyssey Clinic System</p>
        <h1 className="splash-screen__title">{clinicName}</h1>
        <p className="splash-screen__subtitle">
          Preparing patient records, schedules, and secure access...
        </p>

        <div className="splash-screen__loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}
