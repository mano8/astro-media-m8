export type MediaRouteFragments = {
  base?: string;
  upload?: string | false;
  library?: string | false;
  object?: string | false;
  presets?: string | false;
  admin?: string | false;
};

export type BuiltMediaRoutes = {
  upload?: string;
  library?: string;
  object?: string;
  presets?: string;
  admin?: string;
};

const DEFAULT_FRAGMENTS: Required<Omit<MediaRouteFragments, "base">> & { base: string } = {
  base: "",
  upload: "/media/upload",
  library: "/media",
  object: "/media/object/[id]",
  presets: "/media/presets",
  admin: "/admin/media"
};

function joinRoute(base: string, fragment: string): string {
  const value = `/${[base, fragment].join("/")}`.replace(/\/+/g, "/");
  return value === "/" ? "/" : value.replace(/\/$/, "");
}

export function buildMediaRoutes(routes: MediaRouteFragments = {}): BuiltMediaRoutes {
  const merged = { ...DEFAULT_FRAGMENTS, ...routes };
  const base = merged.base ?? "";
  return {
    upload: merged.upload === false ? undefined : joinRoute(base, merged.upload),
    library: merged.library === false ? undefined : joinRoute(base, merged.library),
    object: merged.object === false ? undefined : joinRoute(base, merged.object),
    presets: merged.presets === false ? undefined : joinRoute(base, merged.presets),
    admin: merged.admin === false ? undefined : joinRoute(base, merged.admin)
  };
}

export function routeForLocale(pattern: string, locale?: string): string {
  return locale
    ? pattern.replace("[locale]", locale)
    : pattern.replace("/:locale", "").replace("[locale]", "");
}

export function mediaRedirect(
  routes: BuiltMediaRoutes,
  page: keyof BuiltMediaRoutes,
  locale?: string
): string {
  const route = routes[page];
  if (!route) return "/";
  return routeForLocale(route, locale);
}
