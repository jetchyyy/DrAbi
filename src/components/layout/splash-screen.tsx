function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '234 88 12'; // fallback orange
  const n = parseInt(clean, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

interface SplashScreenProps {
  clinicName: string;
  primaryColor?: string;
}

export function SplashScreen({ clinicName, primaryColor = '#ea580c' }: SplashScreenProps) {
  const rgb = hexToRgb(primaryColor);
  const [r, g, b] = rgb.split(' ');

  return (
    <section
      className="splash-screen"
      aria-label="Loading screen"
      style={{
        '--splash-r': r,
        '--splash-g': g,
        '--splash-b': b,
      } as React.CSSProperties}
    >
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
