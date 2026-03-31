import { useEffect } from 'react';
import { DISMISS_TOAST } from '../context/actions';
import { useLibraryContext } from '../context/AppContext';

function Toast({ toasts }) {
  const { dispatch } = useLibraryContext();

  useEffect(() => {
    const timers = toasts.map((toast) => window.setTimeout(() => {
      dispatch({ type: DISMISS_TOAST, payload: toast.id });
    }, 3200));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dispatch, toasts]);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-50 space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto min-w-[280px] rounded-[14px] border px-4 py-3 shadow-panel backdrop-blur-xl ${
            toast.tone === 'error'
              ? 'border-red/30 bg-red/10 text-red-100'
              : 'border-white/10 bg-overlay/95 text-primary'
          }`}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}

export default Toast;
