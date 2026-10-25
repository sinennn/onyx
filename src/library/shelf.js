// Reading-progress helpers and shelf ordering. `progress` is the zero-based index of the last
// page read, so a comic is finished once it reaches the final page.

export const LIBRARY_SORTS = [
  { id: 'recent', label: 'Recent' },
  { id: 'title', label: 'Title' },
  { id: 'progress', label: 'Progress' },
];

const titleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function isFinished(comic) {
  const progress = comic.progress || 0;
  return comic.pageCount > 1 && progress > 0 && progress >= comic.pageCount - 1;
}

export function isInProgress(comic) {
  return (comic.progress || 0) > 0 && !isFinished(comic);
}

export function readFraction(comic) {
  return comic.pageCount > 0 ? Math.min(1, (comic.progress || 0) / comic.pageCount) : 0;
}

function lastOpenedTime(comic) {
  return comic.lastOpened ? new Date(comic.lastOpened).getTime() : 0;
}

function byTitle(left, right) {
  return titleCollator.compare(left.title || '', right.title || '');
}

// In-progress comics first (furthest along first), then unread, then finished.
function progressRank(comic) {
  if (isFinished(comic)) return 2;
  return (comic.progress || 0) > 0 ? 0 : 1;
}

export function sortLibrary(library, sort = 'recent') {
  const comics = [...library];
  if (sort === 'title') {
    return comics.sort(byTitle);
  }
  if (sort === 'progress') {
    return comics.sort((left, right) => (
      progressRank(left) - progressRank(right)
      || readFraction(right) - readFraction(left)
      || byTitle(left, right)
    ));
  }
  return comics.sort((left, right) => lastOpenedTime(right) - lastOpenedTime(left) || byTitle(left, right));
}

// Matches every word of the query against the title or the file name, ignoring case and accents.
export function filterLibrary(library, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) {
    return library;
  }

  return library.filter((comic) => {
    const fileName = (comic.filePath || '').split('/').pop();
    const haystack = normalize(`${comic.title || ''} ${fileName}`);
    return words.every((word) => haystack.includes(word));
  });
}

function normalize(value) {
  return (value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// The "Currently reading" banner: the most recent comic still in progress, else the most recent
// unfinished one, else the most recent of all.
export function pickHeroComic(library) {
  const recent = sortLibrary(library, 'recent');
  return recent.find(isInProgress) || recent.find((comic) => !isFinished(comic)) || recent[0] || null;
}
