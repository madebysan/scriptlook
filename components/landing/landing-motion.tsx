"use client";

import { useEffect } from "react";

type LandingMotionProps = {
  rootId: string;
};

export function LandingMotion({ rootId }: LandingMotionProps) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    const revealElements = Array.from(
      root.querySelectorAll<HTMLElement>(".paper-motion-reveal"),
    );
    const initialLoadElements = new Set(
      root.querySelectorAll<HTMLElement>(".paper-motion-load-with-hero"),
    );
    root.classList.add("paper-motion-enabled");

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      revealElements.forEach((element) => element.classList.add("is-in-view"));
      return () => {
        root.classList.remove("paper-motion-enabled");
      };
    }

    initialLoadElements.forEach((element) => element.classList.add("is-in-view"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-in-view");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.16,
      },
    );

    revealElements.forEach((element) => {
      if (initialLoadElements.has(element)) return;
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      root.classList.remove("paper-motion-enabled");
    };
  }, [rootId]);

  return null;
}
