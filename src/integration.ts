import type { AstroIntegration } from "astro";
import { buildMediaRoutes, type MediaRouteFragments } from "./runtime/routes.js";
import type { MediaCategory, MediaVisibility } from "./runtime/schemas.js";

export type FaMediaAstroOptions = {
  apiBase?: string;
  v1Base?: string;
  legacyBase?: string;
  mode?: "headless" | "starter";
  output?: "static" | "server" | "hybrid";
  locales?: string[];
  defaultLocale?: string;
  auth?: {
    provider?: "fa-auth-astro" | "custom" | "none";
    adapterImport?: string;
    requireAuth?: boolean;
    adminRole?: "superadmin" | "admin" | "is_superuser";
  };
  routes?: MediaRouteFragments;
  views?: {
    strategy?: "none" | "package" | "scaffolded";
    layout?: "plain" | "starlight" | "custom";
    customLayoutImport?: string;
    componentsImport?: string;
    i18nImport?: string;
  };
  upload?: {
    maxClientBytes?: number;
    allowedMimeTypes?: string[];
    defaultCategory?: MediaCategory;
    defaultVisibility?: MediaVisibility;
    concurrentUploads?: number;
    checksum?: "none" | "sha256";
  };
  polling?: {
    variantJobMs?: number;
    uploadScanMs?: number;
    timeoutMs?: number;
  };
  admin?: {
    enabled?: boolean;
    exposeMaintenance?: boolean;
    exposeQuotas?: boolean;
  };
  guards?: {
    middleware?: boolean;
  };
};

const ROUTE_ENTRYPOINTS = {
  upload: "@fa-m8/astro-media-m8/routes/upload.astro",
  library: "@fa-m8/astro-media-m8/routes/library.astro",
  object: "@fa-m8/astro-media-m8/routes/object/[id].astro",
  presets: "@fa-m8/astro-media-m8/routes/presets.astro",
  admin: "@fa-m8/astro-media-m8/routes/admin/media.astro"
} as const;

const AUTH_INTEGRATION_NAME = "@fa-m8/astro-auth-m8";

/**
 * Warn when the official auth plugin is not registered before this one — order
 * matters because the media adapter resolves the auth runtime at module load.
 */
function checkAuthOrder(integrations: { name?: string }[] | undefined, logger?: { warn: (m: string) => void }): void {
  const names = (integrations ?? []).map((entry) => entry?.name);
  const authIndex = names.indexOf(AUTH_INTEGRATION_NAME);
  const mediaIndex = names.indexOf("@fa-m8/astro-media-m8");
  if (authIndex === -1) {
    logger?.warn(
      `auth.provider is "fa-auth-astro" but ${AUTH_INTEGRATION_NAME} is not in the integrations list`
    );
  } else if (mediaIndex !== -1 && authIndex > mediaIndex) {
    logger?.warn(`${AUTH_INTEGRATION_NAME} should be listed before @fa-m8/astro-media-m8`);
  }
}

export default function faMedia(options: FaMediaAstroOptions = {}): AstroIntegration {
  const mode = options.mode ?? "headless";
  const provider = options.auth?.provider ?? "fa-auth-astro";
  const routes = buildMediaRoutes(options.routes);

  return {
    name: "@fa-m8/astro-media-m8",
    hooks: {
      "astro:config:setup": ({ injectRoute, addMiddleware, updateConfig, config, logger }) => {
        updateConfig({
          vite: {
            define: {
              "import.meta.env.PUBLIC_FA_MEDIA_API_BASE": JSON.stringify(options.apiBase ?? "/media"),
              "import.meta.env.PUBLIC_FA_MEDIA_V1_BASE": JSON.stringify(options.v1Base ?? "/v1"),
              "import.meta.env.PUBLIC_FA_MEDIA_LEGACY_BASE": JSON.stringify(options.legacyBase ?? ""),
              "import.meta.env.PUBLIC_FA_MEDIA_ADMIN_ROLE": JSON.stringify(options.auth?.adminRole ?? "is_superuser")
            }
          }
        });

        // media-service-m8 only accepts fa-auth-m8-issued tokens, so the auth
        // adapter must be backed by fa-auth-m8 (official astro-auth-m8 plugin,
        // or a custom adapter that obtains fa-auth-m8 tokens).
        if (provider === "fa-auth-astro") {
          checkAuthOrder(config?.integrations, logger);
        } else if (provider === "custom" && !options.auth?.adapterImport) {
          logger?.warn(
            "auth.provider is \"custom\" but no auth.adapterImport was given; configure a fa-auth-m8-compatible MediaAuthAdapter via setMediaAuthAdapter()"
          );
        }

        const starter = mode === "starter" && (options.views?.strategy ?? "package") !== "none";
        if (starter && provider === "none") {
          logger?.warn(
            "media starter routes are enabled but auth.provider is \"none\"; media-service-m8 requires fa-auth-m8 authentication"
          );
        }

        if (starter) {
          for (const [name, pattern] of Object.entries(routes)) {
            if (!pattern) continue;
            if (name === "admin" && options.admin?.enabled === false) continue;
            injectRoute({
              pattern,
              entrypoint: ROUTE_ENTRYPOINTS[name as keyof typeof ROUTE_ENTRYPOINTS]
            });
          }
        }

        if (options.guards?.middleware) {
          addMiddleware({ order: "pre", entrypoint: "@fa-m8/astro-media-m8/middleware" });
        }
      }
    }
  };
}

export { buildMediaRoutes } from "./runtime/routes.js";
export type { MediaRouteFragments, BuiltMediaRoutes } from "./runtime/routes.js";
