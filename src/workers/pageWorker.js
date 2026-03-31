const MAX_DIMENSION = 2400;
const LOSSY_TYPES = new Set(['image/jpeg', 'image/webp', 'image/avif']);
const CONVERT_TYPES = new Set(['image/bmp', 'image/x-ms-bmp', 'image/tiff']);

self.onmessage = async (event) => {
  if (event.data.type !== 'process-page') {
    return;
  }

  const { id, buffer, mimeType } = event.data;

  try {
    const blob = new Blob([buffer], { type: mimeType || 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const needsResize = Math.max(bitmap.width, bitmap.height) > MAX_DIMENSION;
    const needsConversion = CONVERT_TYPES.has(mimeType);

    if (!needsResize && !needsConversion) {
      self.postMessage({ id, buffer, mimeType: blob.type || 'image/png' }, [buffer]);
      return;
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const outputType = needsConversion
      ? 'image/png'
      : (LOSSY_TYPES.has(mimeType) ? 'image/jpeg' : 'image/png');

    const processed = await canvas.convertToBlob({
      type: outputType,
      quality: outputType === 'image/jpeg' ? 0.92 : undefined,
    });
    const nextBuffer = await processed.arrayBuffer();
    self.postMessage({ id, buffer: nextBuffer, mimeType: processed.type }, [nextBuffer]);
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Unable to process this page.' });
  }
};
