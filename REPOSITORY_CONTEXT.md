# astro-media-m8

## Layer

Client (optional Astro media plugin).

## Purpose

Provide the Astro integration and headless media client for `media-service-m8`.
The plugin is optional per deployment: it requires an installed package and a
configured `PUBLIC_MEDIA_API_BASE`, degrades safely when absent, and never forces
host source edits outside documented registration points.

## Responsibilities

- Model the public `media-service-m8` contract and expose typed HTTP API wrappers.
- Provide the integration, auth adapter, upload controller, optional React
  provider/hooks, injectable starter routes, and default UI without consumer-side
  configuration code.
- Maintain package metadata and compatibility checks for the supported service
  contract.

## Repository boundaries

- Own the Astro integration and media-client package, not the media service or the
  host application.
- Do not import `media-service-m8` source code or another optional plugin. Use
  published package contracts and HTTP only.
- Consumers own package installation, environment configuration, i18n labels, and
  final UI composition.

## Backend and public contract

- Communicate with `media-service-m8` over HTTP only; never import service code.
- Publish `@mano8/astro-media-m8` and keep `mediaServiceM8` package metadata,
  schemas, and compatibility checks aligned with the `media-service-m8@1.0`
  contract (`>=1.0.0 <2.0.0`).
- Model public backend responses only; never expose secret or session fields.
- Export public modules only through explicit `package.json` subpaths.

## Package version alignment

- Keep the package version and `package-lock.json` version synchronized.
- Change the service contract range only with matching schema and compatibility
  updates; never widen it silently.

## Authentication and UI boundaries

- Require `@mano8/astro-auth-m8` as the official M8 auth peer. Couple only through
  `MediaAuthAdapter` / `createFaAuthAdapter`, wiring it after `faAuth`.
- `headless` provides schemas, API wrappers, upload control, and the auth adapter
  without pages; `starter` adds upload, library, object, presets, and admin Astro
  routes; `scaffolded` uses consumer-owned views.
- Admin routes and maintenance actions require the admin pre-guard; destructive
  actions belong in focused confirmation panels. The media admin landing view is
  dashboard-oriented.
- Registry skins use shadcn/Tailwind patterns and import live logic from this
  package's `/react` and `/hooks` exports rather than reimplementing it.

## Runtime ownership

- `src/runtime/authAdapter.ts` owns the adapter implementations;
  `src/runtime/client.ts` owns base resolution, bearer attachment, one refresh
  retry, the admin pre-guard, and 204 handling.
- `src/runtime/upload/**` owns the presigned-POST upload controller and
  `sha256Hex`; `src/runtime/api/**` owns media API wrappers. `internal.server`
  is server-only and must never reach browser bundles.

## Repository commands

- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run test:unit`

## Standalone authority

This file, repository documentation, and existing CI are the authoritative local
context. A verified nearest workspace may optionally add launcher-selected
policies and tasks; its absence is a successful standalone condition and does not
make a parent workspace necessary.
