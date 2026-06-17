# @fa-m8/astro-media-m8

Astro integration and headless client for [`media-service-m8`]. The media-side
analog of `@fa-m8/astro-auth-m8`: typed Zod schemas, API wrappers for the full
media contract, a presigned-upload controller, optional React provider/hooks,
and injectable starter routes — so any Astro stack can drive media without
re-implementing the contract.

Pinned to `media-service-m8@0.0` (supported service-version range
`>=0.0.8 <0.1.0`; see `mediaServiceM8` in `package.json`).

## Backend contract

This package targets the `media-service-m8@0.0` API contract and was tested
against `media-service-m8` service version `0.0.8`. Supported backend service
versions are `>=0.0.8 <0.1.0` (the floor is the first release exposing the
discovery route). The contract major.minor tracks the pre-1.0 package line.

Compatibility helpers are exported from `@fa-m8/astro-media-m8/compatibility`.
`media-service-m8` (≥ 0.0.8) exposes a public `GET {API_PREFIX}/meta` route
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

## Commands

- `npm run build` — `tsc` → `dist/`
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest with coverage (100% on the non-React runtime)

[`media-service-m8`]: ../media-service-m8
