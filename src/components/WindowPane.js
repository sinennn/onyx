import { useReaderContext } from '../context/AppContext';

function WindowPane() {
  const { view, currentComic } = useReaderContext();

  const sectionLabel = view === 'reader'
    ? currentComic?.title || 'Reading'
    : view === 'settings'
      ? 'Preferences'
      : 'Library';

  return (
    <header className="window-pane titlebar-drag flex h-[52px] shrink-0 items-center justify-between border-b border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] px-4 pl-[84px] select-none">
      <span className="label-caps text-muted">Onyx</span>
      <span className="label-caps max-w-[260px] truncate text-right text-muted">{sectionLabel}</span>
    </header>
  );
}

export default WindowPane;
