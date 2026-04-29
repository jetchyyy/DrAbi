import { ChevronLeft, ChevronRight, GraduationCap, Stethoscope, UserCog } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';
import { useDoctorDirectory } from '../../../hooks/use-clinic-data';

/*
 * Place individual doctor photos in /public/doctors/
 * Filenames: doctor-1.jpg through doctor-5.jpg
 *
 * Nano Banana portrait prompt:
 * "A professional doctor in a crisp white lab coat with a stethoscope around the neck,
 * standing in a slight 3/4 turn pose with a warm confident smile, soft clinic background
 * with warm neutral bokeh, photorealistic portrait, even warm lighting, full upper-body
 * centered composition, clean background suitable for cropping, ultra-sharp detail,
 * approachable and professional demeanor, orange warm accent light on shoulders"
 */
const DOCTOR_PORTRAITS = [
  {
    img: '/doctors/doctor-1.jpg',
    name: 'Dr. Dan Ken Shen Penera',
    specialty: 'General Medicine',
    desc: 'Specializes in comprehensive primary care and preventive medicine, crafting personalized wellness plans for every patient.',
  },
  {
    img: '/doctors/doctor-2.jpg',
    name: 'Dr. Johnjosfir Roca',
    specialty: 'General Medicine',
    desc: 'Dedicated to evidence-based treatments and compassionate care for patients of all ages and diverse medical backgrounds.',
  },
  {
    img: '/doctors/doctor-3.jpg',
    name: 'Dr. Jetch Merald Madaya',
    specialty: 'General Medicine',
    desc: 'Committed to building lasting doctor-patient relationships through attentive, personalized medical consultation.',
  },
  {
    img: '/doctors/doctor-4.jpg',
    name: 'Dr. Joshua Bonghanoy',
    specialty: 'General Medicine',
    desc: 'Experienced in diagnosing and managing chronic conditions, focusing on sustainable quality-of-life improvements.',
  },
  {
    img: '/doctors/doctor-5.jpg',
    name: 'Dr. Harvey Dave de Gracia',
    specialty: 'General Medicine',
    desc: 'Passionate about preventive health education and empowering patients to make informed decisions for better outcomes.',
  },
];

/* ── Single orange doctor card ───────────────────────────── */
type DoctorPortrait = typeof DOCTOR_PORTRAITS[0];

function DoctorCard({ doctor, active }: { doctor: DoctorPortrait; active: boolean }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      className={`group relative flex h-full flex-col items-center overflow-visible rounded-3xl bg-white p-7 text-center shadow-xl transition-all duration-500 ease-out hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-400/50 ${
        active ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-70'
      }`}
    >
      {/* Dot-grid decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <svg
          className="absolute right-0 top-0 opacity-[0.07]"
          width="120" height="120" viewBox="0 0 120 120"
          fill="none" aria-hidden="true"
        >
          {[0, 15, 30, 45, 60, 75, 90, 105].map(cx =>
            [0, 15, 30, 45, 60, 75, 90, 105].map(cy => (
              <circle key={`${cx}-${cy}`} cx={cx + 7} cy={cy + 7} r="2.5" fill="#ea580c" />
            ))
          )}
        </svg>
        <svg
          className="absolute bottom-0 left-0 opacity-[0.05]"
          width="80" height="80" viewBox="0 0 80 80"
          fill="none" aria-hidden="true"
        >
          {[0, 15, 30, 45, 60].map(cx =>
            [0, 15, 30, 45, 60].map(cy => (
              <circle key={`${cx}-${cy}`} cx={cx + 7} cy={cy + 7} r="2" fill="#ea580c" />
            ))
          )}
        </svg>
      </div>

      {/* Circular photo with glow ring */}
      <div className="relative mb-5 flex-shrink-0">
        <div className="absolute inset-[-5px] animate-pulse rounded-full bg-orange-200 blur-sm [animation-duration:3s]" />
        <div className="relative h-32 w-32 overflow-hidden rounded-full ring-4 ring-orange-200 shadow-xl transition-transform duration-500 group-hover:scale-105">
          {!imgError ? (
            <img
              src={doctor.img}
              alt={`Portrait of ${doctor.name}`}
              className="h-full w-full object-cover object-top"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-orange-100">
              <Stethoscope className="size-12 text-orange-400" aria-hidden="true" />
            </div>
          )}
        </div>
        {/* Available pulse dot */}
        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md">
          <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400 [animation-duration:2s]" />
        </span>
      </div>

      {/* Name */}
      <h3 className="text-base font-black leading-tight text-slate-950">{doctor.name}</h3>

      {/* Specialty badge */}
      <span className="mt-2 inline-block rounded-full bg-orange-50 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-orange-600">
        {doctor.specialty}
      </span>

      {/* Divider */}
      <div className="my-4 h-px w-full bg-orange-100" />

      {/* Description */}
      <p className="line-clamp-3 text-sm leading-relaxed text-slate-500">{doctor.desc}</p>

      <div className="flex-1" />
    </div>
  );
}

/* ── Carousel shell ──────────────────────────────────────── */
const CAROUSEL_GAP = 20; // px — matches gap-5

function DoctorCarousel({ doctors }: { doctors: typeof DOCTOR_PORTRAITS }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3);
  const trackRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = doctors.length;
  const maxIndex = Math.max(0, total - visibleCount);

  const measure = useCallback(() => {
    const vc = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1;
    setVisibleCount(vc);
    if (trackRef.current?.firstElementChild) {
      setCardWidth((trackRef.current.firstElementChild as HTMLElement).offsetWidth);
    }
    setActiveIndex(i => Math.min(i, Math.max(0, total - vc)));
  }, [total]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIndex(i => (i >= Math.max(0, total - visibleCount) ? 0 : i + 1));
    }, 7000);
  }, [total, visibleCount]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const goTo = (index: number) => {
    setActiveIndex(Math.max(0, Math.min(index, maxIndex)));
    resetTimer();
  };

  return (
    <div className="relative px-6 sm:px-8">
      {/* Track */}
      <div className="overflow-x-clip pt-4 pb-1" style={{ overflowY: 'visible' }}>
        <div
          ref={trackRef}
          className="flex gap-5"
          style={{
            transform: cardWidth ? `translateX(-${activeIndex * (cardWidth + CAROUSEL_GAP)}px)` : undefined,
            transition: 'transform 1s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {doctors.map((doc, i) => (
            <div
              key={doc.name}
              className="w-full flex-shrink-0 sm:w-[calc(50%_-_0.625rem)] lg:w-[calc(33.333%_-_0.8333rem)]"
            >
              <DoctorCard doctor={doc} active={i >= activeIndex && i < activeIndex + visibleCount} />
            </div>
          ))}
        </div>
      </div>

      {/* Prev arrow */}
      <button
        onClick={() => goTo(activeIndex - 1)}
        disabled={activeIndex === 0}
        className="absolute left-1 top-[40%] z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg shadow-orange-200/60 ring-1 ring-orange-100 transition-all duration-200 hover:bg-orange-500 hover:text-white hover:shadow-xl hover:shadow-orange-300/60 disabled:pointer-events-none disabled:opacity-35 sm:left-2"
        aria-label="Previous doctors"
      >
        <ChevronLeft className="size-5" />
      </button>

      {/* Next arrow */}
      <button
        onClick={() => goTo(activeIndex + 1)}
        disabled={activeIndex >= maxIndex}
        className="absolute right-1 top-[40%] z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg shadow-orange-200/60 ring-1 ring-orange-100 transition-all duration-200 hover:bg-orange-500 hover:text-white hover:shadow-xl hover:shadow-orange-300/60 disabled:pointer-events-none disabled:opacity-35 sm:right-2"
        aria-label="Next doctors"
      >
        <ChevronRight className="size-5" />
      </button>

      {/* Dot indicators */}
      <div className="mt-7 flex justify-center gap-2" role="tablist" aria-label="Doctor carousel">
        {Array.from({ length: maxIndex + 1 }).map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === activeIndex}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────── */
export function DoctorsSection() {
  const { data: doctors = [] } = useDoctorDirectory();
  const directBookableDoctors = doctors.filter((doctor) => doctor.role === 'doctor');

  return (
    <section
      className="relative overflow-hidden px-5 pb-16 pt-12 sm:px-8"
      aria-labelledby="portal-doctors-heading"
    >
      {/* Drop your image at /public/doctors-section-bg.jpg */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'url(/doctors-section-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(0.92)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(15,23,42,0.58) 0%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.46) 30%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.76) 64%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.90) 100%)',
        }}
      />
      {/* ── Abstract background shapes ──────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Large navy rotated block — top-right */}
        <div className="absolute -right-28 -top-16 h-[360px] w-[360px] rotate-[18deg] rounded-[3.5rem] bg-slate-900/80" />
        {/* Soft white blob — bottom-left */}
        <div className="absolute -bottom-20 -left-20 h-[320px] w-[320px] rounded-full bg-white/20 blur-2xl" />
        {/* Mid floating glow — top-center */}
        <div className="absolute left-1/3 top-10 h-40 w-40 animate-pulse rounded-full bg-white/15 blur-3xl [animation-duration:5s]" />
        {/* Pulsing amber orb — center-right */}
        <div className="absolute right-1/4 top-1/2 h-24 w-24 animate-pulse rounded-full bg-amber-300/25 blur-xl [animation-duration:7s]" />
        {/* Hollow white ring — bottom-right */}
        <div className="absolute bottom-16 right-12 h-24 w-24 rounded-full border-[12px] border-white/35" />
        {/* Small hollow white ring — mid-left */}
        <div className="absolute left-10 top-1/3 h-16 w-16 rounded-full border-[8px] border-white/30" />
        {/* Thin rotated pill — bottom-center */}
        <div className="absolute bottom-20 left-1/2 h-3 w-20 -translate-x-1/2 rotate-[-18deg] rounded-full bg-slate-900/20" />
        {/* Dot cluster — SVG, top-left */}
        <svg
          className="absolute left-4 top-8 opacity-25"
          width="72" height="72" viewBox="0 0 72 72" fill="none"
          aria-hidden="true"
        >
          {[0, 18, 36, 54].map(cx =>
            [0, 18, 36, 54].map(cy => (
              <circle key={`${cx}-${cy}`} cx={cx + 9} cy={cy + 9} r="3" fill="white" />
            ))
          )}
        </svg>
        {/* Radial colour washes */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 80% 8%, rgba(255,255,255,0.12) 0%, transparent 50%), radial-gradient(ellipse at 10% 92%, rgba(15,23,42,0.18) 0%, transparent 46%)',
          }}
        />
      </div>

      {/* Section header */}
      <div className="relative z-10 mb-10">
        <ScrollReveal yOffset={20}>
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">Medical Team</span>
            </div>
            <h2
              id="portal-doctors-heading"
              className="text-4xl font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:text-5xl"
            >
              Meet Our Specialists
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.35)] sm:text-base">
              Board-certified physicians delivering compassionate, evidence-based care and personalized support at
              every step of your treatment journey.
            </p>
          </div>
        </ScrollReveal>
      </div>

      {/* Portrait carousel ────────────────────────────── */}
      <ScrollReveal className="relative z-10" delayMs={180} yOffset={18}>
        <DoctorCarousel doctors={DOCTOR_PORTRAITS} />
      </ScrollReveal>

      {/* ── Live DB doctor directory ─────────────────────── */}
      {directBookableDoctors.length > 0 && (
        <>
          <ScrollReveal className="relative z-10 my-10" delayMs={220} yOffset={14}>
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/40" />
              <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 ring-1 ring-white/30">
                <GraduationCap className="size-3.5 text-white" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-widest text-white/90">Also on our team</span>
              </div>
              <div className="h-px flex-1 bg-white/40" />
            </div>
          </ScrollReveal>
          <div className="relative z-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {directBookableDoctors.map((doctor, i) => (
              <ScrollReveal key={doctor.id} delayMs={280 + i * 80} yOffset={18}>
                <div
                  className="group flex flex-col items-center overflow-hidden rounded-3xl bg-white p-6 text-center shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-400/50"
                >
                  {/* Avatar circle */}
                  <div className="relative mb-4">
                    <div className="absolute inset-[-4px] animate-pulse rounded-full bg-orange-200 blur-sm [animation-duration:3.5s]" />
                    <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-orange-100 ring-4 ring-orange-200 shadow-lg transition-transform duration-300 group-hover:scale-105">
                      <UserCog className="size-10 text-orange-500" aria-hidden="true" />
                    </div>
                    <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 [animation-duration:2s]" />
                    </span>
                  </div>

                  <h3 className="text-sm font-black leading-tight text-slate-950">{doctor.fullName}</h3>
                  {doctor.specialtyName && (
                    <span className="mt-1.5 inline-block rounded-full bg-orange-50 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-orange-600">
                      {doctor.specialtyName}
                    </span>
                  )}

                  <div className="my-3 h-px w-full bg-orange-100" />
                  <p className="text-xs leading-relaxed text-slate-500">
                    Accepting new patients and available for same-day bookings through the portal.
                  </p>

                  <div className="flex-1" />
                </div>
              </ScrollReveal>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

