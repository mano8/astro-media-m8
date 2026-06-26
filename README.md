# @fa-m8/astro-media-m8

Astro integration and headless client for [`media-service-m8`]. The media-side
analog of `@fa-m8/astro-auth-m8`: typed Zod schemas, API wrappers for the full
media contract, a presigned-upload controller, optional React provider/hooks,
and injectable starter routes — so any Astro stack can drive media without
re-implementing the contract.

Pinned to `media-service-m8@0.0` (supported service-version range
`>=0.0.10 <0.1.0`; see `mediaServiceM8` in `package.json`).

## Backend contract

This package targets the `media-service-m8@0.0` API contract and was tested
against `media-service-m8` service version `0.0.10`. Supported backend service
versions are `>=0.0.10 <0.1.0` (the floor is the first release supporting the
media library sorting contract). The contract major.minor tracks the pre-1.0
package line.

Compatibility helpers are exported from `@fa-m8/astro-media-m8/compatibility`.
`media-service-m8` (>= 0.0.10) exposes a public `GET {API_PREFIX}/meta` route
returning a `ServiceMeta` payload — pass it straight to the assert:

```ts
import { assertMediaServiceM8Compatibility } from "@fa-m8/astro-media-m8/compatibility";

const meta = await fetch(`${base}/media/meta`).then((r) => r.json());
// meta = { service, version, api_version, contract: { name, version, range } }
assertMediaServiceM8Compatibility(meta); // reads nested contract.version + version
```

The helper also accepts flat fields (`media_contract_version` /
`contract_version` / `service_version`) for backends that surface metadata
elsewhere.

## Install

```sh
npm i @fa-m8/astro-media-m8 @fa-m8/astro-auth-m8 zod
```

`@fa-m8/astro-auth-m8` is a required peer: `media-service-m8` only accepts
`fa-auth-m8`-issued tokens, so the plugin's auth adapter must be backed by
`fa-auth-m8` (the official plugin, or a custom adapter that obtains those
tokens). `react`/`react-dom` are optional — only `./react`, `./hooks` and the
starter views need them.

## Modes

- **headless** — schemas, API wrappers, upload controller, stores; no pages.
- **starter** — injects upload / library / object / presets / admin routes.
- **scaffolded** — `views.strategy: "scaffolded"` to own the view files.

## Quick start

```ts
// astro.config.mjs
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import faAuth from "@fa-m8/astro-auth-m8";
import faMedia from "@fa-m8/astro-media-m8";

export default defineConfig({
  integrations: [
    react(),
    faAuth({ apiBase: "/user" }),                 // list auth BEFORE media
    faMedia({ apiBase: "/media", v1Base: "/v1", mode: "starter" })
  ]
});
```

Wire the auth adapter once (browser entry / provider):

```ts
import { getToken } from "@fa-m8/astro-auth-m8/client";
import { refreshToken } from "@fa-m8/astro-auth-m8/api";
import { createFaAuthAdapter, setMediaAuthAdapter } from "@fa-m8/astro-media-m8/auth-adapter";

setMediaAuthAdapter(createFaAuthAdapter({ getToken, refreshToken }));
```

## Headless usage

```ts
import { objects, uploads } from "@fa-m8/astro-media-m8/api";
import { createMediaUploadController } from "@fa-m8/astro-media-m8/upload";

const controller = createMediaUploadController({
  file, category: "asset", visibility: "private", checksum: "sha256", waitForScan: true
});
controller.on("progress", (state) => console.log(state.state, state.fraction));
const object = await controller.start();

const page = await objects.list({ category: "asset", limit: 20 });
```

## Security model

- Access tokens are delegated to the auth adapter and **never persisted** here.
- Service tokens are server-only: `@fa-m8/astro-media-m8/internal-server` throws
  if imported in the browser and is excluded from the client `api` barrel.
- The browser→storage upload uses the presigned POST policy only — **no bearer
  token** is sent to MinIO/S3.
- Admin calls are gated client-side (`ForbiddenError`) before the request when
  the adapter already knows the user is not a superuser.
- Every response body is parsed through Zod; `204` responses skip parsing.
- Request URLs are protocol-pinned to http(s).

## Content Security Policy

When `guards.middleware` is enabled, the integration injects a `Content-Security-Policy`
header on every response. The `connect-src` directive is built to cover `'self'` and the
media API origin (when `apiBase` is an absolute URL).

**Browser-direct storage uploads** use the presigned POST returned by the media service,
so the browser also needs `fetch` access to the MinIO/S3 public endpoint. Without this,
a tight `connect-src` blocks the upload even though the presign itself comes from the
media API.

Pass the storage public origin in `csp.storageOrigin` — it must match the
`MINIO_PUBLIC_ENDPOINT` set in the media-service stack:

```ts
faMedia({
  apiBase: "/media",
  guards: { middleware: true },
  csp: {
    storageOrigin: "https://minio.example.com:9000", // matches MINIO_PUBLIC_ENDPOINT
  },
})
```

`storageOrigin` is an operator deploy setting, not a plugin contract value. If it is
omitted, empty, or not a valid absolute URL, it is silently ignored. Use
`csp.connectExtraOrigins` for any other trusted origins that must reach `connect-src`.

## shadcn views (registry)

For shadcn/Tailwind apps, this package ships a **shadcn registry** of ready-to-run
styled admin views. The headless logic stays a live dependency
(`@fa-m8/astro-media-m8/react` + `/hooks`); only the **skin** is copied into the
consumer, so views adopt the app's own tokens and are fully editable. The registry
items are pre-built into the package at `registry/r/*.json` (regenerate with
`npm run build:registry`; the output matches `shadcn build`).

### Hosting model — local file registry

The registry is consumed as a **local file** out of `node_modules` (no external host
or token). Because shadcn resolves namespaced registries (`@name/item`) over HTTP,
local consumption uses the **direct `.json` path** form of `shadcn add`. Optionally
declare the namespace in `components.json` for documentation / future HTTP hosting:

```jsonc
// components.json
"registries": {
  "@fa-m8-media": "./node_modules/@fa-m8/astro-media-m8/registry/r/{name}.json"
}
```

### Items

| Item | `shadcn add` (run from the consumer project root) | registryDependencies | npm dependencies | Needs `@fa-m8/astro-media-m8`? |
| :-- | :-- | :-- | :-- | :-- |
| `data-table` | `npx shadcn add ./node_modules/@fa-m8/astro-media-m8/registry/r/data-table.json` | `table`, `button`, `input` | `@tanstack/react-table` | no |
| `media-storage-chart` | `npx shadcn add ./node_modules/@fa-m8/astro-media-m8/registry/r/media-storage-chart.json` | `chart` | `recharts` | no |
| `media-dashboard-overview` | `npx shadcn add ./node_modules/@fa-m8/astro-media-m8/registry/r/media-dashboard-overview.json` | `card`, `button`, `skeleton`, `media-storage-chart`, `data-table` | `lucide-react`, `@tanstack/react-table` | **yes** (`useMediaAdmin`) |
| `media-maintenance-panel` | `npx shadcn add ./node_modules/@fa-m8/astro-media-m8/registry/r/media-maintenance-panel.json` | `card`, `button`, `alert-dialog` | `lucide-react` | **yes** (`useMediaAdmin`) |
| `admin-media-dashboard` | `npx shadcn add ./node_modules/@fa-m8/astro-media-m8/registry/r/admin-media-dashboard.json` | `tabs`, `media-dashboard-overview`, `media-maintenance-panel` | `lucide-react` | **yes** (`MediaProvider`, `RequireSuperuser`) |

`media-dashboard-overview` is the admin **landing** view (storage stat cards + a
per-category storage chart + a subscriptions `data-table` with a delete row action).
The destructive operations (purge-stale / repair-orphans / purge-expired) are demoted
to `media-maintenance-panel`, each behind a shadcn `alert-dialog` confirmation.
`admin-media-dashboard` is the full shell that wires both into a `Tabs` view (dashboard
first) inside the package's `MediaProvider` + `RequireSuperuser`; drop the two panels
into your own shell instead if you already own the media chrome (as fa-ui-m8 does).
Each reads its headless logic straight from `useMediaAdmin` and takes its strings via
`labels`.

Files land under `src/components/fa-media/` (the items' `target`), import shadcn
primitives via `@/components/ui/*`, and pull headless logic from the installed package.
The plugin package is intentionally **not** listed in item `dependencies` (it would make
`shadcn add` try to install an unpublished package); install it yourself as a peer.

### Consumer expectations

- shadcn configured with `style: radix-nova`, `baseColor: neutral`, `cssVariables: true`,
  lucide icons, and Tailwind v4 tokens in `src/styles/global.css`.
- `@fa-m8/astro-media-m8` installed, plus its **required peer `@fa-m8/astro-auth-m8`** —
  media-service only accepts fa-auth-m8 tokens, so a `MediaProvider` backed by a
  fa-auth adapter must be in the tree and the signed-in user must be a superuser.
- Operator env: `PUBLIC_MEDIA_API_BASE` enables the media plugin; the integration injects
  the internal `PUBLIC_FA_MEDIA_*` form consumed by the provider config.
- All view labels are props with English defaults — pass your own i18n strings to localize.

## Commands

- `npm run build` — `tsc` → `dist/` + `npm run build:registry`
- `npm run build:registry` — regenerate `registry/r/*.json` from `registry.json`
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest with coverage (100% on the non-React runtime)

[`media-service-m8`]: ../media-service-m8
