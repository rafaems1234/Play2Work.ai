import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

export function useCountUp(value, { duration = 0.8 } = {}) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    const controls = animate(prevValue.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return display;
}
