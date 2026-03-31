import ChevronLeftIcon from './icons/ChevronLeftIcon';
import FitHeightIcon from './icons/FitHeightIcon';
import FitWidthIcon from './icons/FitWidthIcon';
import FullscreenIcon from './icons/FullscreenIcon';
import OriginalSizeIcon from './icons/OriginalSizeIcon';
import SidebarIcon from './icons/SidebarIcon';

const fitIcons = {
  'fit-width': FitWidthIcon,
  'fit-height': FitHeightIcon,
  original: OriginalSizeIcon,
};

function Toolbar({
  title,
  currentPage,
  pageCount,
  fitMode,
  visible,
  onBack,
  onToggleFit,
  onToggleFullscreen,
  onToggleThumbnails,
}) {
  const FitIcon = fitIcons[fitMode] || FitWidthIcon;
  const fitLabel = fitMode === 'fit-width' ? 'Fit Width' : fitMode === 'fit-height' ? 'Fit Height' : 'Original';

  return (
    <header className={`reader-chrome pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-6 pt-5 ${visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'}`}>
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center border border-white/8 bg-black/55 text-secondary backdrop-blur-xl transition-colors duration-150 hover:border-white/16 hover:text-primary"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleThumbnails}
          className="flex h-10 w-10 items-center justify-center border border-white/8 bg-black/55 text-secondary backdrop-blur-xl transition-colors duration-150 hover:border-white/16 hover:text-primary"
        >
          <SidebarIcon className="h-4 w-4" />
        </button>
        <div className="ml-3 border-l border-white/8 pl-4">
          <p className="label-caps text-muted">Now Reading</p>
          <p className="display-title mt-1 max-w-[420px] truncate text-[28px] leading-none text-primary">{title}</p>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <div className="border border-white/8 bg-black/55 px-3 py-2 font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.18em] text-secondary backdrop-blur-xl">
          {currentPage + 1} / {pageCount}
        </div>
        <button
          type="button"
          onClick={onToggleFit}
          className="flex h-10 items-center gap-2 border border-white/8 bg-black/55 px-3 text-sm text-secondary backdrop-blur-xl transition-colors duration-150 hover:border-white/16 hover:text-primary"
        >
          <FitIcon className="h-4 w-4" />
          <span className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.18em]">{fitLabel}</span>
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="flex h-10 w-10 items-center justify-center border border-white/8 bg-black/55 text-secondary backdrop-blur-xl transition-colors duration-150 hover:border-white/16 hover:text-primary"
        >
          <FullscreenIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export default Toolbar;
