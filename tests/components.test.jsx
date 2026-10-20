import { fireEvent, render } from '@testing-library/react';
import DropZone from '../src/components/DropZone';
import HeroBanner from '../src/components/HeroBanner';

describe('DropZone', () => {
  it('shows its active visual state', () => {
    const { container } = render(<DropZone active />);

    expect(container.firstChild).toHaveClass('opacity-100');
    expect(container.querySelector('.animate-pulseSoft')).toBeInTheDocument();
  });
});

describe('HeroBanner', () => {
  it('renders the import action when the library is empty', () => {
    const onImport = vi.fn();
    const { getByRole } = render(<HeroBanner onImport={onImport} />);

    fireEvent.click(getByRole('button', { name: /import comics/i }));
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('opens a featured comic when selected', () => {
    const onOpen = vi.fn();
    const comic = { title: 'Test Comic', coverURL: '', pageCount: 12, progress: 0 };
    const { getByRole } = render(<HeroBanner comic={comic} onOpen={onOpen} />);

    fireEvent.click(getByRole('button', { name: /test comic/i }));
    expect(onOpen).toHaveBeenCalledWith(comic);
  });
});
