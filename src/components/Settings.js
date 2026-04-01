import { UPDATE_SETTINGS } from '../context/actions';
import { useLibraryContext } from '../context/AppContext';
import { themes } from '../theme/themes';
import appIcon from '../../buildResources/icon.png';

function Settings({ libraryApi }) {
  const { settings, appVersion, dispatch } = useLibraryContext();
  const updateState = libraryApi?.updateState || {
    state: 'idle',
    currentVersion: appVersion,
    availableVersion: null,
    downloadedVersion: null,
    progress: 0,
    message: '',
  };

  const updateSettings = (patch) => {
    if (libraryApi?.updateSettings) {
      libraryApi.updateSettings(patch);
      return;
    }

    dispatch({ type: UPDATE_SETTINGS, payload: patch });
  };

  const isCheckingUpdates = updateState.state === 'checking' || updateState.state === 'downloading';
  const canInstallUpdate = updateState.state === 'downloaded';
  const updateHeadline = canInstallUpdate
    ? 'Update Ready'
    : updateState.state === 'downloading'
      ? 'Downloading Update'
      : updateState.state === 'available'
        ? 'Update Found'
        : updateState.state === 'development'
          ? 'Production Builds Only'
          : updateState.state === 'error'
            ? 'Update Error'
            : 'Automatic Updates';
  const updateMessage = updateState.message
    || (updateState.currentVersion ? `Current version ${updateState.currentVersion}` : 'Keep Onyx current without reinstalling from scratch.');

  return (
    <div className="app-scroll h-full overflow-y-auto px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="label-caps text-accent">Preferences</p>
        <h2 className="display-title mt-3 text-[44px] leading-none text-primary">Reader Settings</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">
          Tune how Onyx feels. Themes change the room around the books, while reader settings control how each issue opens.
        </p>

        <div className="mt-10 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="border border-white/6 bg-surface p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="label-caps text-muted">Theme Vault</p>
                <h3 className="display-title mt-3 text-[34px] leading-none text-primary">Pick A Mood</h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">
                  Your icon sets the tone: glossy black, monochrome, deliberate. These themes push that mood into different collector personas.
                </p>
              </div>
              <img
                src={appIcon}
                alt="Onyx icon"
                className="h-16 w-16"
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {themes.map((theme) => {
                const selected = settings.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => updateSettings({ theme: theme.id })}
                    className={`theme-card border p-4 text-left transition-colors duration-150 ${selected ? 'border-accent bg-accent/5' : 'border-white/6 bg-black/10 hover:border-white/12'}`}
                    style={{
                      '--theme-accent': theme.preview.accent.replace('#', '').match(/.{1,2}/g).map((value) => Number.parseInt(value, 16)).join(' '),
                      '--theme-ambient': theme.preview.ambient.replace('#', '').match(/.{1,2}/g).map((value) => Number.parseInt(value, 16)).join(' '),
                    }}
                  >
                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="label-caps text-muted">Theme</p>
                          <h4 className="display-title mt-3 text-[26px] leading-none text-primary">{theme.name}</h4>
                        </div>
                        <span
                          className="h-7 w-7 border border-white/10"
                          style={{ background: `linear-gradient(135deg, ${theme.preview.accent}, ${theme.preview.surface})` }}
                        />
                      </div>
                      <p className="mt-4 text-sm leading-6 text-secondary">{theme.tagline}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="space-y-5">
            <section className="border border-white/6 bg-surface p-6">
              <p className="label-caps text-muted">Default Fit Mode</p>
              <select
                value={settings.defaultFitMode}
                onChange={(event) => updateSettings({ defaultFitMode: event.target.value })}
                className="mt-4 w-full border border-white/6 bg-elevated px-4 py-3 text-sm text-primary outline-none"
              >
                <option value="fit-width">Fit Width</option>
                <option value="fit-height">Fit Height</option>
                <option value="original">Original</option>
              </select>
            </section>

            <section className="border border-white/6 bg-surface p-6">
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-sm font-semibold text-primary">Remember reading position</p>
                  <p className="mt-1 text-sm text-secondary">Resume comics from the last saved page when reopening them.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSettings({ rememberReadingPosition: !settings.rememberReadingPosition })}
                  className={`relative h-8 w-14 transition-colors duration-150 ${settings.rememberReadingPosition ? 'bg-accent' : 'bg-overlay'}`}
                >
                  <span className={`absolute top-1 h-6 w-6 bg-white transition-[left] duration-150 ${settings.rememberReadingPosition ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </section>

            <section className="border border-white/6 bg-surface p-6">
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-sm font-semibold text-primary">Show progress underlines</p>
                  <p className="mt-1 text-sm text-secondary">Keep the thin shelf markers visible in the library.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSettings({ showProgressBars: !settings.showProgressBars })}
                  className={`relative h-8 w-14 transition-colors duration-150 ${settings.showProgressBars ? 'bg-accent' : 'bg-overlay'}`}
                >
                  <span className={`absolute top-1 h-6 w-6 bg-white transition-[left] duration-150 ${settings.showProgressBars ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </section>

            <section className="border border-white/6 bg-surface p-6">
              <p className="label-caps text-muted">App Updates</p>
              <h3 className="display-title mt-3 text-[28px] leading-none text-primary">{updateHeadline}</h3>
              <p className="mt-3 text-sm leading-7 text-secondary">
                {updateMessage}
              </p>
              <div className="mt-4 space-y-2 font-['JetBrains_Mono'] text-[11px] uppercase tracking-[0.16em] text-secondary">
                <p>Installed {updateState.currentVersion || appVersion}</p>
                {updateState.availableVersion ? <p>Available {updateState.availableVersion}</p> : null}
                {updateState.downloadedVersion ? <p>Ready {updateState.downloadedVersion}</p> : null}
                {updateState.state === 'downloading' ? <p>Progress {Math.round(updateState.progress || 0)}%</p> : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => libraryApi?.checkForUpdates?.()}
                  disabled={isCheckingUpdates}
                  className={`border px-4 py-2 font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.2em] transition-colors duration-150 ${isCheckingUpdates ? 'border-white/8 bg-white/[0.03] text-muted' : 'border-white/12 bg-black/10 text-primary hover:border-white/20 hover:bg-white/[0.05]'}`}
                >
                  {isCheckingUpdates ? 'Checking...' : 'Check Now'}
                </button>
                {canInstallUpdate ? (
                  <button
                    type="button"
                    onClick={() => libraryApi?.installUpdate?.()}
                    className="border border-accent bg-accent px-4 py-2 font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.2em] text-white transition-colors duration-150 hover:bg-[#ff564b]"
                  >
                    Restart To Update
                  </button>
                ) : null}
              </div>
            </section>

            <section className="border border-white/6 bg-surface p-6">
              <p className="label-caps text-muted">App Version</p>
              <p className="mt-3 font-['JetBrains_Mono'] text-[12px] uppercase tracking-[0.2em] text-primary">{appVersion}</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
