import { useCallback, useRef, useState } from 'react';

export function useDominantColor(imageURL) {
  const cacheRef = useRef(new Map());
  const [glowColor, setGlowColor] = useState('rgba(255, 60, 47, 0.22)');

  const primeColor = useCallback(async () => {
    if (!imageURL) {
      return glowColor;
    }

    if (cacheRef.current.has(imageURL)) {
      const cached = cacheRef.current.get(imageURL);
      setGlowColor(cached);
      return cached;
    }

    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';

    const color = await new Promise((resolve, reject) => {
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 18;
        canvas.height = 18;

        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 18, 18);

        const { data } = context.getImageData(0, 0, 18, 18);
        let red = 0;
        let green = 0;
        let blue = 0;
        let total = 0;

        for (let index = 0; index < data.length; index += 4) {
          red += data[index];
          green += data[index + 1];
          blue += data[index + 2];
          total += 1;
        }

        const nextColor = `rgba(${Math.round(red / total)}, ${Math.round(green / total)}, ${Math.round(blue / total)}, 0.42)`;
        resolve(nextColor);
      };
      image.onerror = reject;
      image.src = imageURL;
    }).catch(() => 'rgba(255, 60, 47, 0.22)');

    cacheRef.current.set(imageURL, color);
    setGlowColor(color);
    return color;
  }, [glowColor, imageURL]);

  return { glowColor, primeColor };
}
