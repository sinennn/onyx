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

describe('ContextMenu', () => {
  it('stays open after the right-click that opened it, and closes on Escape or a right-click elsewhere', async () => {
    const { useState } = await import('react');
    const { default: ContextMenu } = await import('../src/components/ContextMenu');
    function Harness() {
      const [menu, setMenu] = useState(null);
      return (
        <div>
          <button type="button" onContextMenu={(event) => { event.preventDefault(); setMenu({ x: 0, y: 0, comic: { title: 'A', pageCount: 10, progress: 3 } }); }}>card</button>
          <p>elsewhere</p>
          <ContextMenu menu={menu} onRead={() => {}} onRemove={() => {}} onClose={() => setMenu(null)} />
        </div>
      );
    }
    const { getByText, queryByText } = render(<Harness />);

    fireEvent.contextMenu(getByText('card'));
    expect(queryByText('Remove from Library')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(queryByText('Remove from Library')).not.toBeInTheDocument();

    fireEvent.contextMenu(getByText('card'));
    fireEvent.contextMenu(getByText('elsewhere'));
    expect(queryByText('Remove from Library')).not.toBeInTheDocument();
  });
});
