import { useEffect, useRef } from 'react';
import BookIcon from './icons/BookIcon';
import TrashIcon from './icons/TrashIcon';

function ContextMenu({ menu, onRead, onRemove, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
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
