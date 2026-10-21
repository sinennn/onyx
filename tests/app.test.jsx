import { render } from '@testing-library/react';
import App from '../src/App';

const dispatch = vi.fn();

vi.mock('../src/context/AppContext', () => ({
  useLibraryContext: () => ({
    library: [],
    settings: { theme: 'onyx' },
    toasts: [],
    dispatch,
  }),
  useReaderContext: () => ({ view: 'library' }),
}));

vi.mock('../src/hooks/useLibrary', () => ({
  useLibrary: () => ({
    pickFiles: vi.fn(),
    openComic: vi.fn(),
    removeComic: vi.fn(),
    closeComic: vi.fn(),
  }),
}));

describe('App', () => {
  it('renders the library shell', () => {
    const { getByText } = render(<App />);

    expect(getByText('Onyx')).toBeInTheDocument();
    expect(getByText('Shelf')).toBeInTheDocument();
  });
});
