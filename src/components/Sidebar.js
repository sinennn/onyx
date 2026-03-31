import { useRef, useState } from 'react';
import { SET_VIEW } from '../context/actions';
import { useReaderContext } from '../context/AppContext';
import AddIcon from './icons/AddIcon';
import LibraryIcon from './icons/LibraryIcon';
import SettingsIcon from './icons/SettingsIcon';
import SidebarIcon from './icons/SidebarIcon';

const navItems = [
  { id: 'library', label: 'Library', icon: LibraryIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { view, dispatch } = useReaderContext();
  const sidebarRef = useRef(null);

  const handleToggle = () => {
    if (sidebarRef.current) {
      sidebarRef.current.style.willChange = 'transform';
    }
    setCollapsed((current) => !current);
  };

  return (
    <aside
      ref={sidebarRef}
      onTransitionEnd={() => {
        if (sidebarRef.current) {
          sidebarRef.current.style.willChange = 'auto';
        }
      }}
      className={`flex h-screen shrink-0 flex-col bg-surface px-3 py-5 shadow-insetSoft transition-[width] duration-150 ${collapsed ? 'w-[84px]' : 'w-[220px]'}`}
    >
      <div className="mb-6 flex items-center justify-between px-2">
        <div className="min-w-0">
          <p className={`label-caps text-secondary transition-opacity duration-150 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>Comic Reader</p>
          <h1 className={`text-xl font-semibold transition-opacity duration-150 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>Panel</h1>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-elevated text-secondary transition-colors duration-150 hover:bg-overlay hover:text-primary"
        >
          <SidebarIcon className="h-4 w-4" />
        </button>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => dispatch({ type: SET_VIEW, payload: item.id })}
              className={`relative flex h-9 w-full items-center rounded-[10px] px-3 text-sm font-medium transition-colors duration-150 ${isActive ? 'bg-accent/10 text-primary' : 'text-secondary hover:bg-overlay hover:text-primary'}`}
            >
              {isActive ? <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" /> : null}
              <Icon className="h-4 w-4 shrink-0" />
              <span className={`ml-3 transition-opacity duration-150 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => window.comicAPI.openFilePicker()}
        className="mt-6 flex h-10 items-center justify-center rounded-[12px] bg-accent px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#669cf7]"
      >
        <AddIcon className="h-4 w-4 shrink-0" />
        <span className={`ml-2 whitespace-nowrap transition-opacity duration-150 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>Import Comics</span>
      </button>

      <div className="mt-auto rounded-[16px] border border-white/5 bg-elevated p-3">
        <p className={`label-caps text-muted transition-opacity duration-150 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>Library Owner</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-warm text-sm font-semibold text-white">
            P
          </div>
          <div className={`min-w-0 transition-opacity duration-150 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
            <p className="truncate text-sm font-medium text-primary">Personal Shelf</p>
            <p className="truncate text-xs text-secondary">Curated for late-night reading</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
