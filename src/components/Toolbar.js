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
  onBack,
  onToggleFit,
  onToggleFullscreen,
  onToggleThumbnails,
}) {
  const FitIcon = fitIcons[fitMode] || FitWidthIcon;

  return (
    <header className="glass-toolbar sticky top-0 z-30 flex h-12 items-center justify-between border-b border-white/5 px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-primary"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleThumbnails}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-primary"
        >
          <SidebarIcon className="h-4 w-4" />
        </button>
        <div className="ml-2">
          <p className="label-caps text-muted">Now Reading</p>
          <p className="max-w-[300px] truncate text-sm font-semibold text-primary">{title}</p>
        </div>
      </div>

      <div className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs font-medium text-secondary">
        {currentPage + 1} / {pageCount}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleFit}
          className="flex h-9 items-center gap-2 rounded-[10px] bg-white/5 px-3 text-sm text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-primary"
        >
          <FitIcon className="h-4 w-4" />
          <span>{fitMode === 'fit-width' ? 'Fit Width' : fitMode === 'fit-height' ? 'Fit Height' : 'Original'}</span>
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-primary"
        >
          <FullscreenIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export default Toolbar;
