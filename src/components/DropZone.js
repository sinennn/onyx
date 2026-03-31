import BookIcon from './icons/BookIcon';

function DropZone({ active }) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/20 px-8 transition-opacity duration-150 ${active ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`w-full max-w-xl rounded-[28px] border-2 border-dashed border-white/15 bg-surface/80 p-12 text-center backdrop-blur-xl transition-all duration-150 ${active ? 'animate-pulseSoft border-accent/60' : ''}`}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
          <BookIcon className="h-8 w-8" />
        </div>
        <h3 className="mt-6 text-2xl font-semibold text-primary">Drop your comics to import</h3>
        <p className="mt-3 text-sm leading-7 text-secondary">
          Panel watches for CBZ and CBR archives dropped anywhere in the window and adds them to your shelf.
        </p>
      </div>
    </div>
  );
}

export default DropZone;
