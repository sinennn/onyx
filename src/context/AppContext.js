import React, { createContext, useContext, useMemo, useReducer } from 'react';
import {
  CLOSE_COMIC,
  DISMISS_TOAST,
  ENQUEUE_TOAST,
  OPEN_COMIC,
  REMOVE_COMIC,
  SET_APP_VERSION,
  SET_CURRENT_PAGE,
  SET_FIT_MODE,
  SET_LIBRARY,
  SET_READER_LOADING,
  SET_TOOLBAR_VISIBILITY,
  SET_VIEW,
  TOGGLE_THUMBNAILS,
  UPDATE_COMIC,
  UPDATE_SETTINGS,
} from './actions';

const LibraryContext = createContext(null);
const ReaderContext = createContext(null);

const initialLibraryState = {
  library: [],
  settings: {
    defaultFitMode: 'fit-width',
    rememberReadingPosition: true,
    showProgressBars: true,
  },
  toasts: [],
  appVersion: '1.0.0',
};

const initialReaderState = {
  view: 'library',
  currentComic: null,
  currentPage: 0,
  fitMode: 'fit-width',
  sidebarOpen: true,
  toolbarVisible: true,
  isLoading: false,
};

function libraryReducer(state, action) {
  switch (action.type) {
    case SET_LIBRARY:
      return {
        ...state,
        library: action.payload,
      };
    case UPDATE_COMIC:
      return {
        ...state,
        library: state.library.some((entry) => entry.filePath === action.payload.filePath)
          ? state.library.map((entry) => (
            entry.filePath === action.payload.filePath
              ? { ...entry, ...action.payload }
              : entry
          ))
          : [...state.library, action.payload],
      };
    case REMOVE_COMIC:
      return {
        ...state,
        library: state.library.filter((entry) => entry.filePath !== action.payload),
      };
    case UPDATE_SETTINGS:
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };
    case ENQUEUE_TOAST:
      return {
        ...state,
        toasts: [...state.toasts, action.payload],
      };
    case DISMISS_TOAST:
      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.payload),
      };
    case SET_APP_VERSION:
      return {
        ...state,
        appVersion: action.payload,
      };
    default:
      return state;
  }
}

function readerReducer(state, action) {
  switch (action.type) {
    case SET_VIEW:
      return {
        ...state,
        view: action.payload,
      };
    case OPEN_COMIC:
      return {
        ...state,
        view: 'reader',
        currentComic: action.payload.comic,
        currentPage: action.payload.startPage || 0,
        fitMode: action.payload.fitMode || state.fitMode,
        toolbarVisible: true,
      };
    case CLOSE_COMIC:
      return {
        ...state,
        view: 'library',
        currentComic: null,
        currentPage: 0,
        toolbarVisible: true,
      };
    case SET_CURRENT_PAGE:
      return {
        ...state,
        currentPage: action.payload,
      };
    case SET_FIT_MODE:
      return {
        ...state,
        fitMode: action.payload,
      };
    case TOGGLE_THUMBNAILS:
      return {
        ...state,
        sidebarOpen: typeof action.payload === 'boolean' ? action.payload : !state.sidebarOpen,
      };
    case SET_TOOLBAR_VISIBILITY:
      return {
        ...state,
        toolbarVisible: action.payload,
      };
    case SET_READER_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
}

const libraryActionTypes = new Set([
  SET_LIBRARY,
  UPDATE_COMIC,
  REMOVE_COMIC,
  UPDATE_SETTINGS,
  ENQUEUE_TOAST,
  DISMISS_TOAST,
  SET_APP_VERSION,
]);

export function AppProvider({ children }) {
  const [libraryState, libraryDispatch] = useReducer(libraryReducer, initialLibraryState);
  const [readerState, readerDispatch] = useReducer(readerReducer, initialReaderState);

  const dispatch = (action) => {
    if (libraryActionTypes.has(action.type)) {
      libraryDispatch(action);
      return;
    }

    readerDispatch(action);
  };

  const libraryValue = useMemo(() => ({
    ...libraryState,
    dispatch,
    libraryDispatch,
  }), [libraryState]);

  const readerValue = useMemo(() => ({
    ...readerState,
    dispatch,
    readerDispatch,
  }), [readerState]);

  return (
    <LibraryContext.Provider value={libraryValue}>
      <ReaderContext.Provider value={readerValue}>
        {children}
      </ReaderContext.Provider>
    </LibraryContext.Provider>
  );
}

export function useLibraryContext() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibraryContext must be used within AppProvider');
  }
  return context;
}

export function useReaderContext() {
  const context = useContext(ReaderContext);
  if (!context) {
    throw new Error('useReaderContext must be used within AppProvider');
  }
  return context;
}

export function useAppContext() {
  const library = useLibraryContext();
  const reader = useReaderContext();

  return {
    ...library,
    ...reader,
    dispatch: library.dispatch,
  };
}
