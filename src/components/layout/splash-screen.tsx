function hexToRgbTriplet(primaryColor: string): string {
  const clean = primaryColor.replace('#', '');
  if (clean.length !== 6) return '125 212 83';
  const n = parseInt(clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r} ${g} ${b}`;
}

interface SplashScreenProps {
  clinicName: string;
  primaryColor?: string;
}

/** Initial app splash: white canvas, prominent logo wordmark, tagline + ring loader. */
export function SplashScreen({ clinicName, primaryColor = '#7dd453' }: SplashScreenProps) {
  const rgb = hexToRgbTriplet(primaryColor);

  return (
    <section
      aria-busy="true"
      aria-label={`Loading ${clinicName} portal`}
      className="splash-screen-v2 fixed inset-0 z-[2147483646] flex flex-col items-center justify-center overflow-hidden bg-white px-6"
    >
      <div className="splash-screen-v2__content flex max-w-lg flex-col items-center text-center">
        <img
          alt={clinicName}
          className="splash-screen-v2__mark -mb-2.5 h-[5.5rem] w-auto max-w-[min(100%,24rem)] object-contain object-center opacity-96 sm:-mb-3 sm:h-[6.625rem]"
          decoding="async"
          height={158}
          src="/logo.png"
          width={420}
        />
        <p className="splash-screen-v2__tag mt-2 text-[0.8125rem] font-medium leading-snug text-slate-500 sm:mt-2 sm:text-sm">
          Preparing your secure workspace
        </p>

        <div className="splash-screen-v2__ringWrap mt-8 sm:mt-9" aria-hidden="true">
          <svg className="splash-screen-v2__svg" fill="none" viewBox="0 0 48 48">
            <circle className="splash-screen-v2__track" cx="24" cy="24" fill="none" r="21" strokeWidth="2" />
            <g className="splash-screen-v2__rotor">
              <circle
                className="splash-screen-v2__arc"
                cx="24"
                cy="24"
                fill="none"
                pathLength="100"
                r="21"
                stroke={`rgb(${rgb.replace(/ /g, ', ')})`}
                strokeLinecap="round"
                strokeWidth="2"
              />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}
