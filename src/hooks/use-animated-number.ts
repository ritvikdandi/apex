import { useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION_MS = 450;

// Ease-in-out: starts slow, speeds up through the middle, settles slow.
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Smoothly tweens a displayed number toward `target` whenever it changes,
// so derived stats (FFMI, fat-free mass, scale position, etc.) count up or
// down instead of snapping.
export function useAnimatedNumber(target: number, duration = DEFAULT_DURATION_MS) {
  const [current, setCurrent] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    const from = currentRef.current;
    const to = target;
    if (from === to) return;

    let rafId: number;
    let start: number | null = null;

    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const t = Math.min(1, elapsed / duration);
      const value = from + (to - from) * easeInOutCubic(t);
      currentRef.current = value;
      setCurrent(value);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return current;
}
