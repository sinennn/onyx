function SpotlightCard({ comic, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(comic)}
      className="relative overflow-hidden rounded-[12px] border border-white/5 bg-surface p-5 text-left transition-colors duration-150 hover:bg-elevated"
    >
      <div className="max-w-[70%]">
        <p className="label-caps text-accent">Spotlight</p>
        <h3 className="mt-3 text-lg font-semibold text-primary">{comic.title}</h3>
        <p className="mt-2 text-sm leading-6 text-secondary">
          {comic.progress > 0 ? `Resume from page ${comic.progress + 1}.` : 'Freshly imported and waiting on your next session.'}
        </p>
      </div>
      <div className="absolute right-5 top-1/2 flex h-20 w-20 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-overlay">
        {comic.coverURL ? (
          <img
            src={comic.coverURL}
            alt={comic.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="label-caps text-muted">Panel</span>
        )}
      </div>
    </button>
  );
}

export default SpotlightCard;
