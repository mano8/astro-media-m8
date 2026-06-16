# @fa-m8/astro-media-m8

Astro integration and headless client for [`media-service-m8`]. The media-side
analog of `@fa-m8/astro-auth-m8`: typed Zod schemas, API wrappers for the full
media contract, a presigned-upload controller, optional React provider/hooks,
and injectable starter routes — so any Astro stack can drive media without
re-implementing the contract.

Pinned to `media-service-m8@1.0` (supported range `>=1.0.0 <2.0.0`; see
`mediaServiceM8` in `package.json`).

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
