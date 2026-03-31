import { UPDATE_SETTINGS } from '../context/actions';
import { useLibraryContext } from '../context/AppContext';

function Settings() {
  const { settings, appVersion, dispatch } = useLibraryContext();

  const updateSettings = (patch) => {
    dispatch({ type: UPDATE_SETTINGS, payload: patch });
  };

  return (
    <div className="app-scroll h-screen overflow-y-auto px-10 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="label-caps text-accent">Preferences</p>
        <h2 className="mt-3 text-3xl font-bold text-primary">Reader settings</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">
          Tune the default page fit and reading memory so the reader opens the way you prefer every time.
        </p>

        <div className="mt-10 space-y-5">
          <section className="rounded-[20px] border border-white/5 bg-surface p-6">
            <p className="label-caps text-muted">Default Fit Mode</p>
            <select
              value={settings.defaultFitMode}
              onChange={(event) => updateSettings({ defaultFitMode: event.target.value })}
              className="mt-4 w-full rounded-[14px] border border-white/5 bg-elevated px-4 py-3 text-sm text-primary outline-none"
            >
              <option value="fit-width">Fit Width</option>
              <option value="fit-height">Fit Height</option>
              <option value="original">Original</option>
            </select>
          </section>

          <section className="rounded-[20px] border border-white/5 bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">Remember reading position</p>
                <p className="mt-1 text-sm text-secondary">Resume comics from the last saved page when reopening them.</p>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ rememberReadingPosition: !settings.rememberReadingPosition })}
                className={`relative h-8 w-14 rounded-full transition-colors duration-150 ${settings.rememberReadingPosition ? 'bg-accent' : 'bg-overlay'}`}
              >
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-[left] duration-150 ${settings.rememberReadingPosition ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </section>

          <section className="rounded-[20px] border border-white/5 bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">Show progress bars</p>
                <p className="mt-1 text-sm text-secondary">Display progress at the bottom of each cover in your library.</p>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ showProgressBars: !settings.showProgressBars })}
                className={`relative h-8 w-14 rounded-full transition-colors duration-150 ${settings.showProgressBars ? 'bg-accent' : 'bg-overlay'}`}
              >
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-[left] duration-150 ${settings.showProgressBars ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </section>

          <section className="rounded-[20px] border border-white/5 bg-surface p-6">
            <p className="label-caps text-muted">App Version</p>
            <p className="mt-3 text-lg font-semibold text-primary">{appVersion}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Settings;
