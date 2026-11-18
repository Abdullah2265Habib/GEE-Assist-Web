/* Small animation helpers for the "What's new" pages: elements that rise into view as you scroll,
   a reading-progress bar, numbers that count up, and a scroll value for parallax and scroll-driven
   scenes. Everything respects prefers-reduced-motion (the CSS turns the transitions off, and the
   counters jump straight to their value). */

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** True once the element has come into view (or, with once = false, while it is in view). */
export function useInView<T extends Element>(
  { once = true, threshold = 0.18, rootMargin = "0px 0px -8% 0px" } = {},
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold, rootMargin]);
  return [ref, inView];
}

type Variant = "up" | "down" | "left" | "right" | "scale" | "blur" | "flip";

/** Fades and slides its content in the first time it scrolls into view. */
export function Reveal({
  children,
  variant = "up",
  delay = 0,
  as = "div",
  className = "",
  style,
  ...rest
}: {
  children?: ReactNode;
  variant?: Variant;
  delay?: number;
  as?: string;
  className?: string;
  style?: CSSProperties;
  id?: string;
  role?: string;
  "aria-label"?: string;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  return createElement(
    as,
    {
      ref,
      className: `reveal reveal-${variant}${inView ? " is-in" : ""} ${className}`.trim(),
      style: { ...style, "--d": `${delay}ms` } as CSSProperties,
      ...rest,
    },
    children,
  );
}

/** A number that counts up from 0 when it first scrolls into view. */
export function CountUp({ to, duration = 1400, suffix = "" }: { to: number; duration?: number; suffix?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0.6 });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return (
    <span ref={ref} className="countup">
      {value}
      {suffix}
    </span>
  );
}

/** A thin bar under the header that fills as the page is read. */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      bar.current?.style.setProperty("--p", String(Math.min(1, Math.max(0, p))));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <div className="scroll-progress" ref={bar} aria-hidden="true" />;
}

/**
 * How far an element has travelled through the viewport: 0 when its top reaches the bottom of the
 * screen, 1 when its bottom leaves the top. Written to the CSS variable --sp on the element, and
 * returned for scenes that need it in JavaScript.
 */
export function useScrollProgress<T extends HTMLElement>(track = false): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = r.height + window.innerHeight;
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / total));
      el.style.setProperty("--sp", p.toFixed(4));
      if (track) setProgress(p);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [track]);
  return [ref, progress];
}

/** Types text out once it scrolls into view. */
export function useTypewriter(text: string, start: boolean, speed = 9, restartKey = 0) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion()) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + 3);
      setShown(i);
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, start, speed, restartKey]);
  return text.slice(0, shown);
}
