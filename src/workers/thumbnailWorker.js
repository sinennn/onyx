// Covers are stored inline in the library and cross the IPC bridge on every sync, so keep them
// small: ~600px wide is sharp for the largest cover card on a Retina display, and JPEG is ~15x
// smaller than PNG for comic art.
const MAX_THUMBNAIL_WIDTH = 600;

let paused = false;
const queue = [];

async function generateThumbnail(task) {
  const { id, buffer, mimeType } = task;
  const blob = new Blob([buffer], { type: mimeType || 'image/png' });
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_THUMBNAIL_WIDTH / bitmap.width);
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(bitmap.width * scale)),
    Math.max(1, Math.round(bitmap.height * scale)),
  );
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const result = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: 0.85,
  });
  const nextBuffer = await result.arrayBuffer();
  self.postMessage({ id, buffer: nextBuffer, mimeType: result.type }, [nextBuffer]);
}

async function flushQueue() {
  if (paused || !queue.length) {
    return;
  }

  const nextTask = queue.shift();
  try {
    await generateThumbnail(nextTask);
  } catch (error) {
    self.postMessage({ id: nextTask.id, error: error.message || 'Unable to create thumbnail.' });
  }

  flushQueue();
}

self.onmessage = (event) => {
  const { type } = event.data;

  if (type === 'pause') {
    paused = true;
    return;
  }

  if (type === 'resume') {
    paused = false;
    flushQueue();
    return;
  }

  if (type === 'generate-thumbnail') {
    queue.push(event.data);
    flushQueue();
  }
};
