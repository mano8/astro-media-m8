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

export function MediaProvider({
  children,
  config,
  adapter
}: {
  children: ReactNode;
  config?: Partial<Omit<MediaRuntimeConfig, "polling">> & { polling?: Partial<MediaRuntimeConfig["polling"]> };
  adapter?: MediaAuthAdapter;
}) {
  const resolved = adapter ?? getMediaAuthAdapter();
  const [user, setUser] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (config) configureMedia(config);
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(resolved.getUser ? resolved.getUser() : null)
      .then((value) => {
        if (!cancelled) setUser(value);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolved]);

  const value = useMemo<MediaContextValue>(
    () => ({
      adapter: resolved,
      user,
      isSuperuser: Boolean(resolved.isSuperuser?.(user)),
      loading
    }),
    [resolved, user, loading]
  );

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMediaContext(): MediaContextValue {
  const context = useContext(MediaContext);
  if (!context) throw new Error("useMediaContext must be used inside MediaProvider");
  return context;
}
