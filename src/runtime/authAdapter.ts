import { getMediaConfig } from "./config.js";

/**
 * Narrow runtime contract the media plugin consumes for authentication.
 *
 * The media plugin never owns token storage or refresh logic; it delegates to
 * whatever the host stack provides. `@mano8/astro-auth-m8` is the official
 * provider, but any object that satisfies this shape works.
 */
export type MediaAuthAdapter = {
  getAccessToken(): string | null | Promise<string | null>;
  refresh?(): Promise<string | null>;
  getUser?(): unknown | Promise<unknown>;
  requireUser?(): Promise<unknown>;
  isSuperuser?(user?: unknown): boolean;
  hasRole?(role: string, user?: unknown): boolean;
  onUnauthenticated?(reason: unknown): void;
};

export type InMemoryAuthAdapter = MediaAuthAdapter & {
  /** Set or clear the in-memory access token (never persisted). */
  setAccessToken(token: string | null): void;
};

/**
 * Best-effort superuser detection that does not depend on a specific user
 * shape: honours an explicit `is_superuser` flag, the configured admin role,
 * or a `roles` array containing it.
 */
export function defaultIsSuperuser(user: unknown, adminRole = getMediaConfig().adminRole): boolean {
  if (!user || typeof user !== "object") return false;
  const record = user as Record<string, unknown>;
  if (record.is_superuser === true) return true;
  if (adminRole !== "is_superuser" && typeof record.role === "string" && record.role === adminRole) {
    return true;
  }
  return Array.isArray(record.roles) && record.roles.includes(adminRole);
}

/** A self-contained adapter that holds the token in memory only. */
export function createInMemoryAuthAdapter(initialToken: string | null = null): InMemoryAuthAdapter {
  let token = initialToken;
  return {
    getAccessToken: () => token,
    setAccessToken: (next) => {
      token = next;
    },
    isSuperuser: (user) => defaultIsSuperuser(user)
  };
}

export type FaAuthBindings = {
  getToken: () => string | null;
  refreshToken?: () => Promise<{ access_token?: string } | string | null | undefined>;
  getUser?: () => unknown | Promise<unknown>;
  isSuperuser?: (user?: unknown) => boolean;
  hasRole?: (role: string, user?: unknown) => boolean;
  onUnauthenticated?: (reason: unknown) => void;
};

/**
 * Build the official adapter from `@mano8/astro-auth-m8` bindings. The bindings
 * are injected by the consumer so the media plugin keeps the auth plugin as an
 * optional peer and never statically imports it.
 */
export function createFaAuthAdapter(bindings: FaAuthBindings): MediaAuthAdapter {
  return {
    getAccessToken: () => bindings.getToken(),
    refresh: async () => {
      if (!bindings.refreshToken) return null;
      const result = await bindings.refreshToken();
      if (!result) return null;
      return typeof result === "string" ? result : result.access_token ?? null;
    },
    getUser: bindings.getUser,
    isSuperuser: (user) => (bindings.isSuperuser ? bindings.isSuperuser(user) : defaultIsSuperuser(user)),
    hasRole: bindings.hasRole,
    onUnauthenticated: bindings.onUnauthenticated
  };
}

let adapter: MediaAuthAdapter = createInMemoryAuthAdapter();

export function setMediaAuthAdapter(next: MediaAuthAdapter): MediaAuthAdapter {
  adapter = next;
  return adapter;
}

export function getMediaAuthAdapter(): MediaAuthAdapter {
  return adapter;
}

export function resetMediaAuthAdapter(): void {
  adapter = createInMemoryAuthAdapter();
}
