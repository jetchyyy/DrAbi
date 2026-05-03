import { ChevronLeft, ChevronRight, GraduationCap, Stethoscope, UserCog } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';
import { useDoctorDirectory } from '../../../hooks/use-clinic-data';
import {
  PORTAL_SECTION_PX,
  PORTAL_SECTION_PY,
  PortalSectionBackdrop,
  portalSectionSubtitleClassnames,
  portalSectionTitleClassnames,
} from '../portal-section-shell';

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

type DoctorPortrait = (typeof DOCTOR_PORTRAITS)[0];

function DoctorCard({ doctor, active }: { doctor: DoctorPortrait; active: boolean }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      className={`group relative flex h-full flex-col items-center rounded-2xl border border-slate-200/60 bg-white/92 p-7 text-center shadow-[0_18px_44px_-22px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.035] backdrop-blur-sm transition duration-500 ease-out ${
        active ? 'opacity-100' : 'opacity-50'
      }`}
    >
      <div className="relative mb-5 flex-shrink-0">
        <div className="relative h-32 w-32 overflow-hidden rounded-full ring-2 ring-[color-mix(in_srgb,var(--color-accent)_38%,transparent)] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.25)] transition-transform duration-300 group-hover:scale-[1.02]">
          {!imgError ? (
            <img
              src={doctor.img}
              alt={`Portrait of ${doctor.name}`}
              className="h-full w-full object-cover object-top"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100">
              <Stethoscope className="size-11 text-[var(--color-accent)]" aria-hidden />
            </div>
          )}
        </div>
        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" aria-hidden />
        </span>
      </div>

      <h3 className="font-sans text-base font-semibold leading-tight text-slate-900">{doctor.name}</h3>

      <span className="mt-2 inline-block rounded-full bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] px-3 py-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-800 ring-1 ring-[color-mix(in_srgb,var(--color-primary)_22%,transparent)]">
        {doctor.specialty}
      </span>

      <div className="my-4 h-px w-full bg-slate-200/80" />

      <p className="line-clamp-3 font-sans text-[13px] leading-relaxed text-slate-500">{doctor.desc}</p>

      <div className="flex-1" />
    </div>
  );
}

const CAROUSEL_GAP = 20;

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
    setActiveIndex((i) => Math.min(i, Math.max(0, total - vc)));
  }, [total]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIndex((i) => (i >= Math.max(0, total - visibleCount) ? 0 : i + 1));
    }, 7000);
  }, [total, visibleCount]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  const goTo = (index: number) => {
    setActiveIndex(Math.max(0, Math.min(index, maxIndex)));
    resetTimer();
  };

  const navBtnClass =
    'absolute top-[42%] z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white shadow-lg shadow-slate-900/[0.07] ring-1 ring-slate-900/[0.04] transition hover:border-[color-mix(in_srgb,var(--color-primary)_55%,transparent)] hover:bg-[var(--color-primary)] hover:text-white disabled:pointer-events-none disabled:opacity-30';

  return (
    <div className="relative">
      <div className="overflow-x-clip pb-1 pt-2" style={{ overflowY: 'visible' }}>
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
              className="w-full shrink-0 sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.8333rem)]"
            >
              <DoctorCard doctor={doc} active={i >= activeIndex && i < activeIndex + visibleCount} />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => goTo(activeIndex - 1)}
        disabled={activeIndex === 0}
        className={`${navBtnClass} left-0 sm:-left-1`}
        aria-label="Previous doctors"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => goTo(activeIndex + 1)}
        disabled={activeIndex >= maxIndex}
        className={`${navBtnClass} right-0 sm:-right-1`}
        aria-label="Next doctors"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>

      <div className="mt-8 flex justify-center gap-2" role="tablist" aria-label="Doctor carousel">
        {Array.from({ length: maxIndex + 1 }).map((_, i) => (
          <button
            key={i}
            role="tab"
            type="button"
            aria-selected={i === activeIndex}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeIndex ? 'w-6 bg-[var(--color-primary)]' : 'w-2 bg-slate-300 hover:bg-slate-400'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export function DoctorsSection() {
  const { data: doctors = [] } = useDoctorDirectory();
  const directBookableDoctors = doctors.filter((doctor) => doctor.role === 'doctor');

  return (
    <section className={`relative isolate overflow-x-clip bg-white ${PORTAL_SECTION_PX} ${PORTAL_SECTION_PY}`} aria-labelledby="portal-doctors-heading">
      <PortalSectionBackdrop />
      <div className="relative z-[1]">
        <div className="relative z-[1] mb-12">
          <ScrollReveal yOffset={20}>
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <p className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">Medical team</p>
              <h2 id="portal-doctors-heading" className={portalSectionTitleClassnames()}>
                Meet our specialists
              </h2>
              <p className={portalSectionSubtitleClassnames('max-w-2xl')}>
                Board-certified physicians delivering compassionate, evidence-based care and personalized support at every step of your journey.
              </p>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal className="relative z-[1]" delayMs={120} yOffset={18}>
          <DoctorCarousel doctors={DOCTOR_PORTRAITS} />
        </ScrollReveal>

        {directBookableDoctors.length > 0 && (
          <>
            <ScrollReveal className="relative z-[1] my-12" delayMs={180} yOffset={14}>
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200/90" />
                <div className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-4 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500 shadow-sm backdrop-blur-sm ring-1 ring-slate-900/[0.04]">
                  <GraduationCap className="size-3.5 text-[var(--color-accent)]" aria-hidden />
                  Also on our team
                </div>
                <div className="h-px flex-1 bg-slate-200/90" />
              </div>
            </ScrollReveal>
            <div className="relative z-[1] grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {directBookableDoctors.map((doctor, i) => (
                <ScrollReveal key={doctor.id} delayMs={220 + i * 70} yOffset={18}>
                  <div className="group flex flex-col items-center rounded-2xl border border-slate-200/60 bg-white/92 p-6 text-center shadow-[0_18px_44px_-22px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/[0.035] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-20px_rgba(15,23,42,0.14)]">
                    <div className="relative mb-4">
                      <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200/60 bg-[color-mix(in_srgb,var(--color-accent)_12%,white)] shadow-inner transition-transform duration-300 group-hover:scale-[1.03]">
                        <UserCog className="size-10 text-[var(--color-accent)]" aria-hidden />
                      </div>
                      <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-white shadow-sm">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" aria-hidden />
                      </span>
                    </div>

                    <h3 className="font-sans text-sm font-semibold leading-tight text-slate-900">{doctor.fullName}</h3>
                    {doctor.specialtyName ?
                      <span className="mt-1.5 inline-block rounded-full bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] px-3 py-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-800 ring-1 ring-[color-mix(in_srgb,var(--color-primary)_22%,transparent)]">
                        {doctor.specialtyName}
                      </span>
                    : null}

                    <div className="my-3 h-px w-full bg-slate-200/80" />
                    <p className="font-sans text-xs leading-relaxed text-slate-500">
                      Accepting new patients and available for same-day bookings through the portal.
                    </p>

                    <div className="flex-1" />
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
