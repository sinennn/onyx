import { useEffect, useState } from 'react';

// Returns `value` once it has stayed the same for `delay` ms, and falls back to `emptyValue`
// immediately when it is cleared. Keeps fast operations from flashing a loading state.
export function useDelayedValue(value, delay, emptyValue = '') {
  const [delayed, setDelayed] = useState(emptyValue);

  useEffect(() => {
    if (value === emptyValue) {
      setDelayed(emptyValue);
      return undefined;
    }

    const timer = window.setTimeout(() => setDelayed(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, emptyValue, value]);

  return delayed;
}
