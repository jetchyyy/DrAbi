import { useEffect, useRef, useState, type PropsWithChildren } from 'react';

type ScrollRevealProps = PropsWithChildren<{
  className?: string;
  delayMs?: number;
  yOffset?: number;
}>;

export function ScrollReveal({ children, className, delayMs = 0, yOffset = 30 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -10% 0px',
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${isVisible ? 'is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={{ transitionDelay: `${delayMs}ms`, ['--sr-y' as string]: `${yOffset}px` }}
    >
      {children}
    </div>
  );
}
