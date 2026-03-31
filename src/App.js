import Library from './views/Library';
import Reader from './views/Reader';
import Sidebar from './components/Sidebar';
import Settings from './components/Settings';
import Toast from './components/Toast';
import { useLibraryContext, useReaderContext } from './context/AppContext';
import { useLibrary } from './hooks/useLibrary';

function App() {
  const libraryState = useLibraryContext();
  const readerState = useReaderContext();
  const libraryApi = useLibrary();

  if (readerState.view === 'reader') {
    return (
      <>
        <Reader libraryApi={libraryApi} />
        <Toast toasts={libraryState.toasts} />
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-base text-primary">
      <Sidebar />
      <main className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top,_rgba(79,142,247,0.1),_transparent_45%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_30%)]">
        {readerState.view === 'settings' ? (
          <Settings />
        ) : (
          <Library libraryApi={libraryApi} />
        )}
      </main>
      <Toast toasts={libraryState.toasts} />
    </div>
  );
}

export default App;
