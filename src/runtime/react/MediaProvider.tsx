import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { configureMedia, type MediaRuntimeConfig } from "../config.js";
import { getMediaAuthAdapter, type MediaAuthAdapter } from "../authAdapter.js";

export type MediaContextValue = {
  adapter: MediaAuthAdapter;
  user: unknown;
  isSuperuser: boolean;
  loading: boolean;
};

const MediaContext = createContext<MediaContextValue | null>(null);

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(
    value &&
      (typeof value === "object" || typeof value === "function") &&
      "then" in value &&
      typeof (value as { then?: unknown }).then === "function"
  );
}

function readAdapterUser(adapter: MediaAuthAdapter): { user: unknown; loading: boolean } {
  if (!adapter.getUser) return { user: null, loading: false };
  try {
    const value = adapter.getUser();
    if (isPromiseLike(value)) return { user: null, loading: true };
    return { user: value, loading: false };
  } catch {
    return { user: null, loading: false };
  }
}

export function MediaProvider({
  children,
  config,
  adapter
}: {
  children: ReactNode;
  config?: Partial<Omit<MediaRuntimeConfig, "polling">> & { polling?: Partial<MediaRuntimeConfig["polling"]> };
  adapter?: MediaAuthAdapter;
}) {
  if (config) configureMedia(config);

  const resolved = adapter ?? getMediaAuthAdapter();
  const [authState, setAuthState] = useState(() => readAdapterUser(resolved));

  useEffect(() => {
    if (!resolved.getUser) {
      setAuthState({ user: null, loading: false });
      return undefined;
    }

    let cancelled = false;
    try {
      const value = resolved.getUser();
      if (!isPromiseLike(value)) {
        setAuthState({ user: value, loading: false });
        return undefined;
      }

      setAuthState((current) => ({ ...current, loading: true }));
      Promise.resolve(value)
        .then((nextUser) => {
          if (!cancelled) setAuthState({ user: nextUser, loading: false });
        })
        .catch(() => {
          if (!cancelled) setAuthState({ user: null, loading: false });
        });
    } catch {
      setAuthState({ user: null, loading: false });
    }

    return () => {
      cancelled = true;
    };
  }, [resolved]);

  const currentUserState = readAdapterUser(resolved);
  const user = currentUserState.loading ? authState.user : currentUserState.user;
  const loading = currentUserState.loading ? authState.loading : false;

  const value = useMemo<MediaContextValue>(
    () => ({
      adapter: resolved,
      user,
      isSuperuser: Boolean(resolved.isSuperuser?.(user)),
      loading
    }),
    [loading, resolved, user]
  );

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMediaContext(): MediaContextValue {
  const context = useContext(MediaContext);
  if (!context) throw new Error("useMediaContext must be used inside MediaProvider");
  return context;
}
