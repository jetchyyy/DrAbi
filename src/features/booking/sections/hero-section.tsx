import { ArrowRight, Award, ImagePlus, MapPin, Phone, Shield, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ScrollReveal } from '../../../components/layout/scroll-reveal';
import { Button } from '../../../components/ui/button';
import { defaultClinicSettings } from '../../../config/clinic';
import { isModuleEnabled } from '../../../config/modules';
import { useClinicSettingsData } from '../../../hooks/use-clinic-data';
import { useAuth } from '../../auth/auth-context';

/*
 * Gemini prompt for /public/doctor-hero.png:
 * "A confident, warmly smiling female doctor standing upright with arms gently crossed,
 * wearing a crisp white lab coat and stethoscope around neck, soft clinic background
 * with warm orange bokeh orbs, photorealistic portrait, golden-white ambient lighting,
 * orange accent rim light on shoulders, full-body centered composition, clean transparent
 * background, ultra-sharp detail, approachable and professional demeanor"
 *
 * Background image for left side:
 * Save as /public/family-clinic-hero-bg.jpg
 */

export function HeroSection() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const { isAuthenticated } = useAuth();
  const bookingEnabled = isModuleEnabled('booking_appointments', clinic.enabledModules);
  const [imgError, setImgError] = useState(false);
  const primaryHeroButtonClass =
    'group rounded-full bg-gradient-to-b from-orange-500 to-orange-600 px-8 py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-300/55 ring-1 ring-orange-300/60 transition-all duration-300 hover:-translate-y-0.5 hover:from-orange-600 hover:to-orange-700 hover:shadow-xl hover:shadow-orange-400/55 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
  const secondaryHeroButtonClass =
    'rounded-full border-2 border-slate-200 bg-white/95 px-8 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
  const tertiaryHeroButtonClass =
    'rounded-full border-2 border-orange-200/80 bg-orange-50/80 px-6 py-4 text-sm font-bold text-orange-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-100/80 hover:text-orange-700 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white 2xl:px-7 2xl:py-5';

  return (
    <section id="portal-hero" className="relative bg-orange-50" style={{ minHeight: '100vh' }}>

      {/* ── MOBILE HERO (< lg) ──────────────────────────────────── */}
      <div className="min-h-dvh overflow-hidden xl:hidden">
        <div className="relative flex min-h-dvh flex-col">
          {/* Full-height background image */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'url(/family-clinic-hero-bg.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'saturate(0.98)',
            }}
          />
          {/* Warm light overlay at top — keeps headline text readable over the image */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[64%] sm:h-[58%]"
            style={{
              background: 'linear-gradient(to bottom, rgba(255,247,237,0.88) 0%, rgba(255,247,237,0.60) 56%, rgba(255,247,237,0) 100%)',
            }}
          />
          {/* Orange gradient overlay — fades in from the bottom of the hero upward */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[80%] sm:h-[74%]"
            style={{
              background: 'linear-gradient(to top, rgba(var(--primary-r),var(--primary-g),var(--primary-b),1) 0%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.92) 22%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.65) 45%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.18) 68%, transparent 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 85% 88%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.28) 0%, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.12) 30%, transparent 62%)',
            }}
          />

          {/* Subtle grid texture — matches other sections */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,0,0,0.15) 39px, rgba(0,0,0,0.15) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(0,0,0,0.15) 39px, rgba(0,0,0,0.15) 40px)',
            }}
          />

          {/* ── Abstract decorative shapes — layered inside the orange gradient zone ── */}
          {/* Large hollow ring — upper edge of orange fade area */}
          <div
            className="pointer-events-none absolute"
            style={{
              top: '44%',
              right: '10px',
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              border: '16px solid rgba(255,255,255,0.13)',
            }}
          />
          {/* Medium hollow ring — mid-right */}
          <div
            className="pointer-events-none absolute"
            style={{
              top: '58%',
              right: '6px',
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              border: '10px solid rgba(255,255,255,0.10)',
            }}
          />
          {/* Filled soft circle — lower-center */}
          <div
            className="pointer-events-none absolute"
            style={{
              bottom: '20%',
              right: '18%',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.40)',
            }}
          />
          {/* Rotated pill — lower-right */}
          <div
            className="pointer-events-none absolute"
            style={{
              bottom: '24%',
              right: '6px',
              width: '85px',
              height: '35px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.09)',
              transform: 'rotate(-28deg)',
            }}
          />
          {/* Small accent circle — left side in orange zone */}
          <div
            className="pointer-events-none absolute"
            style={{
              bottom: '38%',
              left: '12px',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
            }}
          />
          {/* Dot grid — bottom-right corner */}
          <svg
            className="pointer-events-none absolute"
            style={{ bottom: '12%', right: '2px', opacity: 0.14 }}
            width="60"
            height="60"
            viewBox="0 0 80 80"
            fill="none"
            aria-hidden="true"
          >
            {[0, 20, 40, 60].map(cx =>
              [0, 20, 40, 60].map(cy => (
                <circle key={`${cx}-${cy}`} cx={cx + 10} cy={cy + 10} r="3" fill="white" />
              ))
            )}
          </svg>

          {/* ── Top content: badge + headline + paragraph + buttons ── */}
          <ScrollReveal delayMs={80} yOffset={0}>
            <div
              className="relative z-10 flex flex-col gap-6 px-6 pb-6 sm:px-8"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 7.75rem)' }}
            >
            <div
              className="mb-2 flex w-fit items-center gap-2 border border-orange-200 bg-white px-4 py-1.5 shadow-sm"
              style={{ borderRadius: '999px' }}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Patient Portal</span>
            </div>

            <div className="flex flex-col gap-6">
              <h1 className="max-w-md text-[2rem] font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
                Your Health,
                <br />
                <span className="text-orange-500">Our Priority.</span>
              </h1>

              <div className="flex flex-col justify-start gap-4">
                <p className="max-w-md text-base leading-relaxed text-slate-700 sm:text-lg">
                  We treat not only symptoms —{' '}
                  <strong className="text-slate-700">we care</strong> about each person.
                  Book appointments and experience healthcare done right.
                </p>

                {/* CTA buttons — anchored under the text */}
                {bookingEnabled ? (
                  <div className="flex flex-wrap gap-3">
                    {isAuthenticated ? (
                      <Link to="/portal/book">
                        <Button
                          className={primaryHeroButtonClass}
                          style={{ borderRadius: '999px' }}
                        >
                          Book Appointment <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </Button>
                      </Link>
                    ) : (
                      <>
                        <Link to="/portal/register">
                          <Button
                            className={primaryHeroButtonClass}
                            style={{ borderRadius: '999px' }}
                          >
                            Get Started
                          </Button>
                        </Link>
                        <Link to="/login">
                          <Button
                            variant="secondary"
                            className={secondaryHeroButtonClass}
                            style={{ borderRadius: '999px' }}
                          >
                            Sign In
                          </Button>
                        </Link>
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    className="inline-block border border-orange-200 bg-white px-8 py-3 text-sm font-semibold text-orange-600 w-fit"
                    style={{ borderRadius: '999px' }}
                  >
                    Online booking coming soon
                  </div>
                )}
              </div>
            </div>
            </div>
          </ScrollReveal>

          {/* ── Bottom image ── */}
          <ScrollReveal className="relative -mb-12 mt-8 flex flex-1 items-end px-6 sm:px-8" delayMs={140} yOffset={0}>
            {!imgError ? (
              <img
                src="/doctor-hero.png"
                alt="Doctor"
                className="relative z-15 ml-auto h-auto max-h-[31rem] w-full object-contain object-bottom sm:w-[102%] sm:translate-x-2"
                style={{ marginBottom: '-1px' }}
                decoding="async"
                loading="eager"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="relative z-10 ml-auto flex min-h-[24rem] w-full flex-col items-center justify-end gap-3 pb-8 text-center animate-fade-up">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-orange-100">
                  <ImagePlus className="size-10 text-orange-300" />
                </div>
                <p className="text-xs text-slate-400">Place /public/doctor-hero.png</p>
              </div>
            )}
          </ScrollReveal>

          {/* ── Stats pill — fixed to bottom-center of hero container ── */}
          <ScrollReveal delayMs={220} yOffset={0}>
            <div
              className="relative z-10 mx-6 mb-0 w-auto px-6 py-4 sm:mx-8"
              style={{
                background: 'rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.88)',
                backdropFilter: 'blur(8px)',
                borderRadius: '1rem',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
              }}
            >
              <div className="grid grid-cols-3 divide-x divide-orange-400/50 text-center gap-4">
                <div className="px-2">
                  <p className="text-2xl sm:text-3xl font-black tracking-tight text-white">10+</p>
                  <p className="mt-1 text-xs sm:text-sm font-semibold uppercase tracking-wide text-orange-100">Years of care</p>
                </div>
                <div className="px-2">
                  <p className="text-2xl sm:text-3xl font-black tracking-tight text-white">20+</p>
                  <p className="mt-1 text-xs sm:text-sm font-semibold uppercase tracking-wide text-orange-100">Expert doctors</p>
                </div>
                <div className="px-2">
                  <p className="text-2xl sm:text-3xl font-black tracking-tight text-white">100%</p>
                  <p className="mt-1 text-xs sm:text-sm font-semibold uppercase tracking-wide text-orange-100">Digital support</p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* ── DESKTOP HERO (≥ lg) ─────────────────────────────────── */}
      <div className="hidden xl:block">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: '56%',
            backgroundImage: 'url(/family-clinic-hero-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center left',
            filter: 'saturate(0.98)',
          }}
        />
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: '56%',
            background: 'rgba(255, 247, 237, 0.68)',
          }}
        />
        <div
          className="absolute inset-y-0 right-0"
          style={{ width: '51%', borderTopLeftRadius: '92px', borderBottomLeftRadius: '92px', background: 'rgba(var(--primary-r),var(--primary-g),var(--primary-b),1)' }}
        />

        {/* Subtle grid texture — matches other sections */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,0,0,0.15) 39px, rgba(0,0,0,0.15) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(0,0,0,0.15) 39px, rgba(0,0,0,0.15) 40px)',
          }}
        />

        <div
          className="absolute"
          style={{
            top: '-100px',
            left: '28%',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.22) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: '-60px',
            left: '8%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.12) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute"
          style={{
            top: '20%',
            right: '5%',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
          }}
        />

        {/* ── Abstract decorative shapes across the full orange area ── */}
        {/* Large hollow ring — top-right */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: '24px',
            right: '18px',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            border: '28px solid rgba(255,255,255,0.11)',
          }}
        />
        {/* Medium hollow ring — upper-center of orange */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: '12%',
            right: '36%',
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            border: '14px solid rgba(255,255,255,0.08)',
          }}
        />
        {/* Small hollow ring — mid-right */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: '42%',
            right: '6%',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            border: '11px solid rgba(255,255,255,0.10)',
          }}
        />
        {/* Filled soft circle — bottom-left of orange */}
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: '32px',
            right: '44%',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'rgba(var(--primary-r),var(--primary-g),var(--primary-b),0.45)',
          }}
        />
        {/* Small filled circle accent — left edge of orange, mid */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: '32%',
            right: '46%',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.10)',
          }}
        />
        {/* Rotated pill — lower-right */}
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: '20%',
            right: '20px',
            width: '110px',
            height: '42px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.09)',
            transform: 'rotate(-32deg)',
          }}
        />
        {/* Thin diagonal bar — upper-left of orange */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: '8%',
            right: '42%',
            width: '80px',
            height: '8px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.15)',
            transform: 'rotate(34deg)',
          }}
        />
        {/* Dot grid cluster — bottom-right */}
        <svg
          className="pointer-events-none absolute"
          style={{ bottom: '8%', right: '14px', opacity: 0.16 }}
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          aria-hidden="true"
        >
          {[0, 20, 40, 60].map(cx =>
            [0, 20, 40, 60].map(cy => (
              <circle key={`${cx}-${cy}`} cx={cx + 10} cy={cy + 10} r="3.5" fill="white" />
            ))
          )}
        </svg>
        {/* Organic blob — center of orange */}
        <svg
          className="pointer-events-none absolute"
          style={{ top: '48%', right: '28%', opacity: 0.07 }}
          width="180"
          height="180"
          viewBox="0 0 200 200"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M44,-60C56.2,-50.2,64.3,-35.4,68.7,-19.4C73.1,-3.4,73.8,13.8,67.2,28.3C60.6,42.8,46.7,54.6,31.1,62.3C15.5,70,-1.9,73.5,-18.4,69.4C-34.9,65.2,-50.4,53.4,-60.2,38.1C-70,22.8,-74,3.9,-70.3,-13.4C-66.6,-30.7,-55.2,-46.4,-41,-57.2C-26.8,-68,-10.8,-74,3.8,-78.6C18.4,-83.2,31.8,-69.8,44,-60Z"
            transform="translate(100 100)"
            fill="white"
          />
        </svg>
      </div>

      <div
        className="relative z-10 grid w-full items-start px-8 xl:grid-cols-[minmax(0,1fr)_minmax(500px,36vw)_minmax(0,0.92fr)] xl:px-12 2xl:px-20"
        style={{ minHeight: '100vh' }}
      >
        <div className="flex flex-col justify-start pb-16 pt-28 pr-8 animate-slide-left xl:pr-12 2xl:pb-20 2xl:pt-32 2xl:pr-16 2xl:pl-8">
          <div
            className="mb-6 flex w-fit items-center gap-2 border border-orange-200 bg-white px-4 py-1.5 shadow-sm"
            style={{ borderRadius: '999px' }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Patient Portal</span>
          </div>

          <h1 className="text-5xl font-black leading-[1.02] tracking-tight text-slate-900 2xl:text-6xl">
            Your Health,
            <br />
            <span className="text-orange-500">Our Priority.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-500 2xl:text-lg">
            We treat not only symptoms - <strong className="text-slate-700">we care</strong> about each person.
            Book appointments, meet our specialists, and experience healthcare done right.
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5 2xl:gap-3">
            {bookingEnabled ? (
              <>
                {isAuthenticated ? (
                  <Link to="/portal/book">
                    <Button
                      className={`${primaryHeroButtonClass} flex items-center gap-2 px-6 py-4 2xl:px-7 2xl:py-5`}
                      style={{ borderRadius: '999px' }}
                    >
                      Book Appointment <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/portal/register">
                      <Button
                        className={`${primaryHeroButtonClass} flex items-center gap-2 px-6 py-4 2xl:px-7 2xl:py-5`}
                        style={{ borderRadius: '999px' }}
                      >
                        Get Started <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                      </Button>
                    </Link>
                    <Link to="/login">
                      <Button
                        variant="secondary"
                        className={`${secondaryHeroButtonClass} px-6 py-4 2xl:px-7 2xl:py-5`}
                        style={{ borderRadius: '999px' }}
                      >
                        Sign in
                      </Button>
                    </Link>
                  </>
                )}
                <Link to="/portal/my-bookings">
                  <Button
                    variant="secondary"
                    className={tertiaryHeroButtonClass}
                    style={{ borderRadius: '999px' }}
                  >
                    My Bookings
                  </Button>
                </Link>
              </>
            ) : (
              <div
                className="border border-orange-200 bg-white px-6 py-3 text-sm font-semibold text-orange-600"
                style={{ borderRadius: '999px' }}
              >
                Online booking coming soon
              </div>
            )}
          </div>

          <div className="mt-12 flex items-center gap-6 2xl:mt-14 2xl:gap-8">
            <div>
              <p className="text-3xl font-black text-slate-900">10+</p>
              <p className="text-xs font-medium text-slate-400">Years of Experience</p>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <p className="text-3xl font-black text-slate-900">20+</p>
              <p className="text-xs font-medium text-slate-400">Qualified Doctors</p>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <p className="text-3xl font-black text-slate-900">100%</p>
              <p className="text-xs font-medium text-slate-400">Patient Satisfaction</p>
            </div>
          </div>
        </div>

        <div className="relative hidden h-full items-end justify-center overflow-visible pt-10 xl:flex 2xl:pt-12">
          <div
            className="animate-hero-float-1 pointer-events-auto absolute flex items-center gap-2 bg-white shadow-xl"
            style={{ top: '21%', left: '4px', borderRadius: '999px', padding: '10px 20px', zIndex: 30 }}
          >
            <Shield className="size-4 text-orange-500" />
            <span className="text-sm font-bold text-slate-700">Reliability</span>
          </div>
          <div
            className="animate-hero-float-2 pointer-events-auto absolute flex items-center gap-2 bg-white shadow-xl"
            style={{ top: '40%', right: '16px', borderRadius: '999px', padding: '10px 20px', zIndex: 30 }}
          >
            <Star className="size-4 text-orange-500" />
            <span className="text-sm font-bold text-slate-700">Experience</span>
          </div>
          <div
            className="animate-hero-float-3 pointer-events-auto absolute flex items-center gap-2 bg-white shadow-xl"
            style={{ bottom: '23%', right: '-18px', borderRadius: '999px', padding: '10px 20px', zIndex: 30 }}
          >
            <Award className="size-4 text-orange-500" />
            <span className="text-sm font-bold text-slate-700">Professional</span>
          </div>

          {!imgError ? (
            <img
              src="/doctor-hero.png"
              alt="Doctor"
              className="relative z-10 h-full w-full translate-x-6 object-contain object-bottom 2xl:translate-x-12"
              style={{ maxHeight: 'min(84vh, 900px)' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className="relative z-10 flex h-full w-full translate-x-6 items-end justify-center 2xl:translate-x-12"
              style={{ maxHeight: 'min(84vh, 900px)' }}
            >
              <div className="hero-doctor-placeholder">
                <div className="hero-doctor-placeholder__halo" />
                <div className="hero-doctor-placeholder__head" />
                <div className="hero-doctor-placeholder__body" />
                <div className="hero-doctor-placeholder__coat" />
                <div className="hero-doctor-placeholder__card">
                  <ImagePlus className="size-5 text-orange-500" />
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-600">Doctor Image</p>
                    <p className="text-xs font-medium text-slate-500">Place your next image at /public/doctor-hero.png</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex flex-col justify-start pb-16 pt-32 pl-8 text-white animate-slide-right xl:pl-12 2xl:pb-20 2xl:pt-40 2xl:pl-20">

          <h2 className="text-[2rem] font-black leading-tight 2xl:text-[3.25rem]">
            With Advanced
            <br />
            Technologies
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-orange-100 2xl:text-base">
            The latest generation equipment, digital diagnostics, advanced techniques - all of this works for your health.
          </p>

          <div className="mt-6 space-y-3 2xl:space-y-4">
            <div
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '999px' }}
            >
              <MapPin className="size-4 shrink-0 text-orange-200" />
              <span className="truncate">{clinic.address}</span>
            </div>
            <div
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '999px' }}
            >
              <Phone className="size-4 shrink-0 text-orange-200" />
              <span>{clinic.contactNumber}</span>
            </div>
          </div>

          <p className="mt-8 max-w-xs text-xs italic text-orange-200">
            We appreciate every feedback, because it inspires us to become better.
          </p>
        </div>
      </div>
      </div> {/* end desktop hero */}
    </section>
  );
}
