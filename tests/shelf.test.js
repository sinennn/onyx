import { filterLibrary, isFinished, pickHeroComic, sortLibrary } from '../src/library/shelf';

const comic = (title, extra = {}) => ({ title, filePath: `/comics/${title}.cbz`, pageCount: 100, progress: 0, lastOpened: null, ...extra });

describe('isFinished', () => {
  it('is true only once the last page is reached', () => {
    expect(isFinished(comic('a', { progress: 99 }))).toBe(true);
    expect(isFinished(comic('a', { progress: 98 }))).toBe(false);
    expect(isFinished(comic('a', { progress: 0 }))).toBe(false);
    expect(isFinished(comic('a', { pageCount: 0, progress: 0 }))).toBe(false);
  });
});

describe('sortLibrary', () => {
  const library = [
    comic('Issue 10', { lastOpened: '2026-10-01T00:00:00Z', progress: 10 }),
    comic('Issue 2', { lastOpened: '2026-10-20T00:00:00Z', progress: 99 }),
    comic('Annual', { progress: 0 }),
    comic('Issue 1', { lastOpened: '2026-10-10T00:00:00Z', progress: 60 }),
  ];
  const titles = (comics) => comics.map((item) => item.title);

  it('sorts by most recently opened by default', () => {
    expect(titles(sortLibrary(library))).toEqual(['Issue 2', 'Issue 1', 'Issue 10', 'Annual']);
  });

  it('sorts titles naturally', () => {
    expect(titles(sortLibrary(library, 'title'))).toEqual(['Annual', 'Issue 1', 'Issue 2', 'Issue 10']);
  });

  it('puts in-progress comics first, then unread, then finished', () => {
    expect(titles(sortLibrary(library, 'progress'))).toEqual(['Issue 1', 'Issue 10', 'Annual', 'Issue 2']);
  });

  it('does not mutate the library', () => {
    const before = titles(library);
    sortLibrary(library, 'title');
    expect(titles(library)).toEqual(before);
  });
});

describe('filterLibrary', () => {
  const library = [
    comic('Gideon Falls Book 01', { filePath: '/x/Gideon_Falls_v01.cbr' }),
    comic('The Nice House on the Lake'),
    comic('Pokémon Adventures'),
  ];

  it('matches every word in the title or file name, ignoring case and accents', () => {
    expect(filterLibrary(library, 'gideon 01')).toHaveLength(1);
    expect(filterLibrary(library, 'falls_v01')).toHaveLength(1);
    expect(filterLibrary(library, 'POKEMON')).toHaveLength(1);
    expect(filterLibrary(library, 'house gideon')).toHaveLength(0);
  });

  it('returns everything for an empty query', () => {
    expect(filterLibrary(library, '   ')).toBe(library);
  });
});

describe('pickHeroComic', () => {
  it('prefers the most recent comic still in progress over a finished one', () => {
    const finished = comic('Done', { progress: 99, lastOpened: '2026-10-20T00:00:00Z' });
    const reading = comic('Reading', { progress: 40, lastOpened: '2026-10-10T00:00:00Z' });
    expect(pickHeroComic([finished, reading]).title).toBe('Reading');
  });

  it('falls back to an unfinished comic, then to anything', () => {
    const finished = comic('Done', { progress: 99, lastOpened: '2026-10-20T00:00:00Z' });
    expect(pickHeroComic([finished, comic('New')]).title).toBe('New');
    expect(pickHeroComic([finished]).title).toBe('Done');
    expect(pickHeroComic([])).toBeNull();
  });
});
