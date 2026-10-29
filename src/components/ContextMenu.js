import { useEffect, useRef } from 'react';
import { isFinished } from '../library/shelf';
import BookIcon from './icons/BookIcon';
import CheckIcon from './icons/CheckIcon';
import TrashIcon from './icons/TrashIcon';
import UndoIcon from './icons/UndoIcon';

function ContextMenu({ menu, onRead, onMarkRead, onMarkUnread, onRemove, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    // The right-click that opens a menu bubbles up here too; a cover that handled it calls
    // preventDefault, so only right-clicks elsewhere close the menu.
    const close = (event) => {
      if (event.type === 'contextmenu' && event.defaultPrevented) {
        return;
      }
      onClose();
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  if (!menu) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-40 min-w-[190px] rounded-[14px] border border-white/10 bg-overlay/95 p-2 shadow-panel backdrop-blur-xl animate-modalRise"
      style={{ top: menu.y, left: menu.x }}
    >
      <button
        type="button"
        onClick={() => onRead(menu.comic)}
        className="flex h-10 w-full items-center rounded-[10px] px-3 text-sm text-primary transition-colors duration-150 hover:bg-white/5"
      >
        <BookIcon className="mr-3 h-4 w-4" />
        Read
      </button>
      {onMarkRead && menu.comic.pageCount > 1 && !isFinished(menu.comic) ? (
        <button
          type="button"
          onClick={() => onMarkRead(menu.comic)}
          className="flex h-10 w-full items-center rounded-[10px] px-3 text-sm text-primary transition-colors duration-150 hover:bg-white/5"
        >
          <CheckIcon className="mr-3 h-4 w-4" />
          Mark as Read
        </button>
      ) : null}
      {onMarkUnread && menu.comic.progress > 0 ? (
        <button
          type="button"
          onClick={() => onMarkUnread(menu.comic)}
          className="flex h-10 w-full items-center rounded-[10px] px-3 text-sm text-primary transition-colors duration-150 hover:bg-white/5"
        >
          <UndoIcon className="mr-3 h-4 w-4" />
          Mark as Unread
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onRemove(menu.comic)}
        className="flex h-10 w-full items-center rounded-[10px] px-3 text-sm text-red-300 transition-colors duration-150 hover:bg-white/5"
      >
        <TrashIcon className="mr-3 h-4 w-4" />
        Remove from Library
      </button>
    </div>
  );
}

export default ContextMenu;
