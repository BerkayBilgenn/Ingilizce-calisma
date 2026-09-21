"use client";

import { useEffect, useRef } from "react";

export default function StarBurst({ burstKey }: { burstKey: number }) {
  const particles = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (!burstKey || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    particles.current.forEach((particle, index) => {
      if (!particle) return;
      const angle = index * 60;
      particle.animate([
        { opacity: 0, transform: `rotate(${angle}deg) translateY(-6px) scale(.92)` },
        { opacity: 1, offset: .25 },
        { opacity: 0, transform: `rotate(${angle}deg) translateY(-38px) scale(1)` },
      ], { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" });
    });
  }, [burstKey]);

  if (!burstKey) return null;
  return <span className="star-burst" key={burstKey} aria-hidden="true">
    {Array.from({ length: 6 }, (_, index) => <i key={index} ref={(node) => { particles.current[index] = node; }}>★</i>)}
  </span>;
}
