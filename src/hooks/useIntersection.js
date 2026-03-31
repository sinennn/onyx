import { useEffect, useState } from 'react';

export function useIntersection(ref, options = {}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current || isVisible) {
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, {
      rootMargin: '180px',
      threshold: 0.05,
      ...options,
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isVisible, options, ref]);

  return isVisible;
}
