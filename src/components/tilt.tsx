'use client';

import { useRef } from 'react';

/**
 * Tilts its child in 3D toward the pointer, with a soft light
 * highlight that follows the cursor.
 *
 * How the 3D works: `perspective` on the parent gives the scene a
 * camera distance; rotateX/rotateY on the child turn it in that space,
 * so the near edge looks bigger than the far edge. We only write two
 * CSS variables per frame, so the browser composites on the GPU and
 * React never re-renders.
 *
 * Skipped for touch screens (no hover) and reduced-motion users.
 */
export default function Tilt({
  children,
  className = '',
  max = 10,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const canTilt = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches;

  function onMove(e: React.PointerEvent) {
    if (!canTilt() || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0..1
    const y = (e.clientY - rect.top) / rect.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty('--rx', `${(0.5 - y) * max}deg`);
      el.style.setProperty('--ry', `${(x - 0.5) * max}deg`);
      el.style.setProperty('--lx', `${x * 100}%`);
      el.style.setProperty('--ly', `${y * 100}%`);
    });
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  return (
    <div className={`[perspective:1000px] ${className}`}>
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="group/tilt relative h-full transition-transform duration-500 ease-out [transform-style:preserve-3d] [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]"
      >
        {children}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/tilt:opacity-100 [background:radial-gradient(400px_circle_at_var(--lx,50%)_var(--ly,50%),rgb(79_209_255/0.12),transparent_40%)]"
        />
      </div>
    </div>
  );
}
