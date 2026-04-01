import { useEffect } from 'react';
import Library from './views/Library';
import Reader from './views/Reader';
import Sidebar from './components/Sidebar';
import Settings from './components/Settings';
import Toast from './components/Toast';
import WindowPane from './components/WindowPane';
import { useLibraryContext, useReaderContext } from './context/AppContext';
import { useLibrary } from './hooks/useLibrary';

//TODO: IMPLEMENT OTA UPDATES USING ELECTRON-UPDATER, SEE https://www.electron.build/auto-update FOR REFERENCE

function App() {
  const libraryState = useLibraryContext();
  const readerState = useReaderContext();
  const libraryApi = useLibrary();
  const theme = libraryState.settings.theme || 'onyx';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  if (readerState.view === 'reader') {
    return (
      <>
        <div className="flex h-screen flex-col bg-base text-primary">
          <WindowPane />
          <div className="min-h-0 flex-1">
            <Reader libraryApi={libraryApi} />
          </div>
        </div>
        <Toast toasts={libraryState.toasts} />
      </>
    );
  }

  return (
    <>
      <div className="flex h-screen flex-col bg-base text-primary">
        <WindowPane />
        <div className="min-h-0 flex flex-1">
          <Sidebar onImport={libraryApi.pickFiles} />
          <main className="min-w-0 flex-1 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_28%)]">
            {readerState.view === 'settings' ? (
              <Settings libraryApi={libraryApi} />
            ) : (
              <Library libraryApi={libraryApi} />
            )}
          </main>
        </div>
      </div>
      <Toast toasts={libraryState.toasts} />
    </>
  );
}

export default App;
