import { nextLayout, nextPage, pageLabel, previousPage, spreadStart, visiblePages } from '../src/reader/pagination';

describe('spreads', () => {
  it('shows the cover alone, then pairs pages', () => {
    expect(visiblePages(0, 'spread', 10)).toEqual([0]);
    expect(visiblePages(1, 'spread', 10)).toEqual([1, 2]);
    expect(visiblePages(2, 'spread', 10)).toEqual([1, 2]);
    expect(visiblePages(9, 'spread', 10)).toEqual([9]);
    expect(visiblePages(8, 'spread', 9)).toEqual([7, 8]);
  });

  it('aligns any page to the start of its spread', () => {
    expect([0, 1, 2, 3, 4].map((page) => spreadStart(page, 'spread'))).toEqual([0, 1, 1, 3, 3]);
    expect(spreadStart(4, 'single')).toBe(4);
  });

  it('steps through spreads and stops at either end', () => {
    expect(nextPage(0, 'spread', 10)).toBe(1);
    expect(nextPage(1, 'spread', 10)).toBe(3);
    expect(nextPage(9, 'spread', 10)).toBe(9);
    expect(nextPage(7, 'spread', 9)).toBe(7);
    expect(previousPage(3, 'spread')).toBe(1);
    expect(previousPage(2, 'spread')).toBe(0);
    expect(previousPage(0, 'spread')).toBe(0);
  });

  it('labels spreads with a range', () => {
    expect(pageLabel(2, 'spread', 393)).toBe('2–3 / 393');
    expect(pageLabel(0, 'spread', 393)).toBe('1 / 393');
    expect(pageLabel(19, 'single', 393)).toBe('20 / 393');
    expect(pageLabel(19, 'scroll', 393)).toBe('20 / 393');
  });
});

describe('single page and scroll', () => {
  it('moves one page at a time and clamps', () => {
    expect(nextPage(4, 'single', 10)).toBe(5);
    expect(nextPage(9, 'single', 10)).toBe(9);
    expect(previousPage(0, 'single')).toBe(0);
    expect(nextPage(3, 'scroll', 10)).toBe(4);
    expect(nextPage(0, 'single', 0)).toBe(0);
  });

  it('cycles layouts', () => {
    expect(nextLayout('scroll')).toBe('single');
    expect(nextLayout('single')).toBe('spread');
    expect(nextLayout('spread')).toBe('scroll');
  });
});
