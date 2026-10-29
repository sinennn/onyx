// Page maths for the reader layouts. `index` is always zero-based.
//
// - scroll: one long column (the Reader tracks the page you're on as you scroll)
// - single: one page at a time
// - spread: two pages side by side, with the cover on its own like a printed comic,
//           so pages pair up as [0], [1, 2], [3, 4], ...

export const READING_LAYOUTS = [
  { id: 'scroll', label: 'Scroll' },
  { id: 'single', label: 'Single' },
  { id: 'spread', label: 'Spread' },
];

export const READING_DIRECTIONS = [
  { id: 'ltr', label: 'Left to Right' },
  { id: 'rtl', label: 'Right to Left (Manga)' },
];

export function isPaged(layout) {
  return layout === 'single' || layout === 'spread';
}

export function nextLayout(layout) {
  const index = READING_LAYOUTS.findIndex((item) => item.id === layout);
  return READING_LAYOUTS[(index + 1) % READING_LAYOUTS.length].id;
}

/** The first page of the spread containing `index`. */
export function spreadStart(index, layout) {
  const page = Math.max(0, index);
  if (layout !== 'spread' || page === 0) {
    return page;
  }
  return page % 2 === 1 ? page : page - 1;
}

/** Pages on screen, in reading order. */
export function visiblePages(index, layout, pageCount) {
  if (!pageCount) {
    return [];
  }
  const start = Math.min(spreadStart(index, layout), pageCount - 1);
  if (layout !== 'spread' || start === 0 || start + 1 >= pageCount) {
    return [start];
  }
  return [start, start + 1];
}

export function nextPage(index, layout, pageCount) {
  if (!pageCount) {
    return 0;
  }
  if (!isPaged(layout)) {
    return Math.min(pageCount - 1, index + 1);
  }
  const shown = visiblePages(index, layout, pageCount);
  const following = shown[shown.length - 1] + 1;
  return following < pageCount ? following : shown[0];
}

export function previousPage(index, layout) {
  if (!isPaged(layout)) {
    return Math.max(0, index - 1);
  }
  const start = spreadStart(index, layout);
  return start <= 0 ? 0 : spreadStart(start - 1, layout);
}

/** "20 / 393" or, for a spread, "20–21 / 393". */
export function pageLabel(index, layout, pageCount) {
  const shown = isPaged(layout) ? visiblePages(index, layout, pageCount) : [Math.min(index, Math.max(0, pageCount - 1))];
  const range = shown.length === 2 ? `${shown[0] + 1}–${shown[1] + 1}` : `${(shown[0] ?? 0) + 1}`;
  return `${range} / ${pageCount}`;
}
