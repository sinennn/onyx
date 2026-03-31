function HeroBanner({ comic, onOpen, onImport }) {
  if (!comic) {
    return (
      <section className="relative h-[340px] overflow-hidden rounded-[28px] border border-dashed border-white/10 bg-[linear-gradient(135deg,rgba(79,142,247,0.12),rgba(240,98,42,0.08))] p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_35%)]" />
        <div className="relative flex h-full max-w-xl flex-col justify-end">
          <p className="label-caps text-accent">Premium Dark Native</p>
          <h2 className="mt-3 text-4xl font-bold text-primary">Build your shelf one issue at a time.</h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-secondary">
            Drop CBZ or CBR files anywhere in the window and Panel will shape them into a reading library built for long sessions and clean page turns.
          </p>
          <button
            type="button"
            onClick={onImport}
            className="mt-6 inline-flex w-fit items-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#669cf7]"
          >
            Import Comics
          </button>
        </div>
      </section>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(comic)}
      className="group relative block h-[340px] w-full overflow-hidden rounded-[28px] border border-white/5 text-left shadow-panel"
    >
      {comic.coverURL ? (
        <img
          src={comic.coverURL}
          alt={comic.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-r from-elevated to-overlay" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,13,15,0.95),rgba(13,13,15,0.62),transparent)]" />
      <div className="absolute inset-0 flex items-end p-10">
        <div className="max-w-xl">
          <p className="label-caps text-accent">Continue Reading</p>
          <h2 className="mt-3 text-4xl font-bold text-primary">{comic.title}</h2>
          <p className="mt-3 text-sm leading-7 text-secondary">
            {comic.pageCount ? `${comic.pageCount} pages in your library` : 'Ready to read'} {comic.progress > 0 ? `• Resume on page ${comic.progress + 1}` : ''}
          </p>
        </div>
      </div>
    </button>
  );
}

export default HeroBanner;
