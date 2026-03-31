import { SET_VIEW } from '../context/actions';
import { useReaderContext } from '../context/AppContext';
import AddIcon from './icons/AddIcon';
import LibraryIcon from './icons/LibraryIcon';
import SettingsIcon from './icons/SettingsIcon';
import appIcon from '../../buildResources/icon.png';

const navItems = [
  { id: 'library', label: 'Library', icon: LibraryIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function Sidebar({ onImport }) {
  const { view, dispatch } = useReaderContext();

  return (
    <aside
      className="flex h-full w-12 shrink-0 flex-col items-center border-r border-white/5 bg-[#090909] py-3"
    >
      <img
        src={appIcon}
        alt="Onyx icon"
        className="mb-4 h-16 w-16  object-cover shadow-[0_10px_26px_rgba(0,0,0,0.45)]"
      />

      <nav className="mt-2 flex flex-col items-center gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;

          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => dispatch({ type: SET_VIEW, payload: item.id })}
              className={`relative flex h-10 w-10 items-center justify-center border transition-colors duration-150 ${isActive ? 'border-accent bg-accent/10 text-primary' : 'border-transparent text-secondary hover:border-white/10 hover:text-primary'}`}
            >
              {isActive ? <span className="absolute left-0 top-0 h-full w-[2px] bg-accent" /> : null}
              <Icon className="h-4 w-4 shrink-0" />
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        title="Import Comics"
        onClick={onImport}
        className="mt-4 flex h-10 w-10 items-center justify-center border border-accent bg-accent text-white transition-colors duration-150 hover:bg-[#ff564b]"
      >
        <AddIcon className="h-4 w-4 shrink-0" />
      </button>

      <div className="mt-auto flex flex-col items-center gap-3">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center border border-white/8 bg-white/[0.03] text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary"
        >
          OX
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
